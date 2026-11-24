import http from 'http';
import mongoose, { Types } from 'mongoose';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../app';
import { connectDB } from '../config/db';
import { initSocketIO } from '../socket';
import { User } from '../models/User';
import { Company } from '../models/Company';
import { Connection } from '../models/Connection';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';

const PORT = 5053;
const BASE_URL = `http://localhost:${PORT}/api`;
const SOCKET_URL = `http://localhost:${PORT}`;

const runRealTimeTests = async () => {
  console.log('========================================================');
  console.log('   STARTING REAL-TIME MESSAGING & PRESENCE TEST SUITE');
  console.log('========================================================\n');

  await connectDB();
  const app = createApp();
  const server = http.createServer(app);
  initSocketIO(server, 'http://localhost:5173');

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => resolve());
  });

  let testPassed = 0;
  let testFailed = 0;

  const assert = (condition: boolean, msg: string) => {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      testPassed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      testFailed++;
      throw new Error(`Assertion failed: ${msg}`);
    }
  };

  let clientA: ClientSocket | null = null;
  let clientB: ClientSocket | null = null;
  let clientA_tab2: ClientSocket | null = null;
  let clientEve: ClientSocket | null = null;

  try {
    const companyA = await Company.create({
      name: 'RealTime Test Co',
      code: 'RT_' + Date.now(),
      email: `admin_${Date.now()}@rt.com`,
      phone: '1234567890',
      address: '123 Realtime Ave',
      status: 'active',
      settings: {
        timezone: 'UTC',
        officeStartTime: '09:00',
        officeEndTime: '18:00',
        workingDays: ['Monday', 'Tuesday'],
        lateThresholdMinutes: 15,
        attendanceMode: 'MANUAL_PUNCH',
        requireCheckOut: true,
        breakDurationMinutes: 0,
        halfDayThresholdHours: 4,
        overtimeThresholdHours: 9,
        autoCheckoutHoursAfterEnd: 2,
      },
    });

    const companyB = await Company.create({
      name: 'Other Co RT',
      code: 'OTHER_RT_' + Date.now(),
      email: `admin_${Date.now()}@otherrt.com`,
      phone: '9999999999',
      address: '456 Other Ave',
      status: 'active',
      settings: {
        timezone: 'UTC',
        officeStartTime: '09:00',
        officeEndTime: '18:00',
        workingDays: ['Monday', 'Tuesday'],
        lateThresholdMinutes: 15,
        attendanceMode: 'MANUAL_PUNCH',
        requireCheckOut: true,
        breakDurationMinutes: 0,
        halfDayThresholdHours: 4,
        overtimeThresholdHours: 9,
        autoCheckoutHoursAfterEnd: 2,
      },
    });

    const password = 'Password@123';
    const userA = await User.create({
      fullName: 'Alice Realtime',
      email: `alice_${Date.now()}@rt.com`,
      password,
      role: 'EMPLOYEE',
      status: 'active',
      companyId: companyA._id,
      employeeId: 'RT001',
      designation: 'Engineer A',
    });

    const userB = await User.create({
      fullName: 'Bob Realtime',
      email: `bob_${Date.now()}@rt.com`,
      password,
      role: 'EMPLOYEE',
      status: 'active',
      companyId: companyA._id,
      employeeId: 'RT002',
      designation: 'Engineer B',
    });

    const userEve = await User.create({
      fullName: 'Eve OtherCompany',
      email: `eve_${Date.now()}@otherrt.com`,
      password,
      role: 'EMPLOYEE',
      status: 'active',
      companyId: companyB._id,
      employeeId: 'EV001',
      designation: 'Outside Engineer',
    });

    const login = async (email: string) => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      return data.data.token;
    };

    const tokenA = await login(userA.email);
    const tokenB = await login(userB.email);
    const tokenEve = await login(userEve.email);

    // Create mutual accepted connection between A and B
    const pairKeyAB = `${userA._id.toString() < userB._id.toString() ? userA._id : userB._id}:${userA._id.toString() < userB._id.toString() ? userB._id : userA._id}`;
    const connAB = await Connection.create({
      companyId: companyA._id,
      requesterId: userA._id,
      recipientId: userB._id,
      pairKey: pairKeyAB,
      users: [userA._id, userB._id],
      status: 'ACCEPTED',
    });

    const convAB = await Conversation.create({
      companyId: companyA._id,
      pairKey: pairKeyAB,
      participants: [userA._id, userB._id],
      userPreferences: [
        { userId: userA._id, isPinned: false, isArchived: false, isMuted: false },
        { userId: userB._id, isPinned: false, isArchived: false, isMuted: false },
      ],
    });

    console.log('--- 1. REAL-TIME PRESENCE & MULTI-DEVICE TESTS ---');

    // 1a. User A connects to Socket.IO
    clientA = Client(SOCKET_URL, {
      auth: { token: tokenA },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      clientA!.on('connect', () => resolve());
    });
    assert(clientA.connected === true, 'User A connected to Socket.IO');

    // 1b. User B connects to Socket.IO and expects snapshot containing A
    let presenceSnapshotReceived: string[] = [];
    clientB = Client(SOCKET_URL, {
      auth: { token: tokenB },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      clientB!.on('presence:snapshot', (data: { onlineUserIds: string[] }) => {
        presenceSnapshotReceived = data.onlineUserIds;
        resolve();
      });
    });

    assert(
      presenceSnapshotReceived.includes(userA._id.toString()),
      'User B receives presence snapshot with User A shown Online upon connection'
    );

    // 1c. Eve (Company B) connects to Socket.IO and checks presence isolation
    let eveSnapshot: string[] = [];
    clientEve = Client(SOCKET_URL, {
      auth: { token: tokenEve },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      clientEve!.on('presence:snapshot', (data: { onlineUserIds: string[] }) => {
        eveSnapshot = data.onlineUserIds;
        resolve();
      });
    });

    assert(
      !eveSnapshot.includes(userA._id.toString()) && !eveSnapshot.includes(userB._id.toString()),
      'Tenant isolation: User Eve from Company B cannot see presence of Company A users'
    );

    // 1d. User A opens a second tab / device
    clientA_tab2 = Client(SOCKET_URL, {
      auth: { token: tokenA },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve) => {
      clientA_tab2!.on('connect', () => resolve());
    });
    assert(clientA_tab2.connected === true, 'User A second tab/device connected');

    // 1e. Close User A tab 1 -> User A should REMAIN online because tab 2 is still connected!
    let aWentOffline = false;
    clientB.on('user:presence', (data: any) => {
      if (data.userId === userA._id.toString() && data.status === 'offline') {
        aWentOffline = true;
      }
    });

    clientA.disconnect();
    // Wait 500ms to verify no offline broadcast was sent
    await new Promise((r) => setTimeout(r, 500));
    assert(aWentOffline === false, 'User A remains Online when closing 1 of 2 active tabs');

    // 1f. Close User A tab 2 -> now User A's last connection is gone, should broadcast offline!
    const offlinePromise = new Promise<void>((resolve) => {
      clientB!.on('user:presence', (data: any) => {
        if (data.userId === userA._id.toString() && data.status === 'offline') {
          resolve();
        }
      });
    });

    clientA_tab2.disconnect();
    await offlinePromise;
    assert(true, 'User A correctly transitions to Offline when the final active connection disconnects');

    // 1g. Reconnect User A -> transitions back to Online
    const onlinePromise = new Promise<void>((resolve) => {
      clientB!.on('user:presence', (data: any) => {
        if (data.userId === userA._id.toString() && data.status === 'online') {
          resolve();
        }
      });
    });

    clientA = Client(SOCKET_URL, {
      auth: { token: tokenA },
      transports: ['websocket'],
    });
    await onlinePromise;
    assert(true, 'User A reconnecting broadcasts Online status to User B without page refresh');

    console.log('\n--- 2. REAL-TIME MESSAGING WITHOUT REFRESHING ---');

    // 2a. A sends a message to B -> B receives it in real time via Socket.IO
    const msgReceivedByB = new Promise<any>((resolve) => {
      clientB!.on('message:new', (msg: any) => {
        resolve(msg);
      });
    });

    const sendRes = await fetch(`${BASE_URL}/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        conversationId: convAB._id,
        content: 'Hey Bob, checking real-time messaging without refresh!',
      }),
    });
    const sendData = await sendRes.json();
    assert(sendData.success === true, 'A sent message via REST API');

    const msgPayloadB = await msgReceivedByB;
    assert(msgPayloadB._id === sendData.data._id, 'B received message:new event in real time');
    assert(msgPayloadB.content === 'Hey Bob, checking real-time messaging without refresh!', 'Message content matches exactly');

    // 2b. B replies to A -> A receives it in real time via Socket.IO
    const msgReceivedByA = new Promise<any>((resolve) => {
      clientA!.on('message:new', (msg: any) => {
        resolve(msg);
      });
    });

    const replyRes = await fetch(`${BASE_URL}/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        conversationId: convAB._id,
        content: 'Got your message instantly Alice!',
        replyToMessageId: msgPayloadB._id,
      }),
    });
    const replyData = await replyRes.json();
    assert(replyData.success === true, 'B replied to message via REST API');

    const replyPayloadA = await msgReceivedByA;
    assert(replyPayloadA._id === replyData.data._id, 'A received reply in real time without refreshing');
    assert(replyPayloadA.replyTo.messageId === msgPayloadB._id, 'Quoted reply preview correctly referenced');

    // 2c. Real-time typing indicators
    const typingPromise = new Promise<any>((resolve) => {
      clientB!.on('typing:update', (data: any) => {
        if (data.isTyping) resolve(data);
      });
    });

    clientA.emit('typing:start', { conversationId: convAB._id.toString() });
    const typingData = await typingPromise;
    assert(typingData.userName === 'Alice Realtime', 'B received typing indicator for Alice');

    const typingStopPromise = new Promise<any>((resolve) => {
      clientB!.on('typing:update', (data: any) => {
        if (!data.isTyping) resolve(data);
      });
    });

    clientA.emit('typing:stop', { conversationId: convAB._id.toString() });
    const typingStopData = await typingStopPromise;
    assert(typingStopData.isTyping === false, 'B received typing stop indicator');

    // 2d. Real-time read receipt
    const readPromise = new Promise<any>((resolve) => {
      clientA!.on('message:read_receipt', (data: any) => {
        resolve(data);
      });
    });

    clientB.emit('message:mark_read', { conversationId: convAB._id.toString() });
    const readReceiptData = await readPromise;
    assert(readReceiptData.readBy === userB._id.toString(), 'A received real-time read receipt when B opened chat');
    assert(Array.isArray(readReceiptData.messageIds), 'read_receipt includes array of messageIds');
    assert(readReceiptData.messageIds.includes(msgPayloadB._id), 'Affected message ID included in read receipt');

    // Verify DB status is read
    const dbMsg = await Message.findById(msgPayloadB._id);
    assert(dbMsg?.status === 'read', 'Message status in MongoDB is read');

    console.log('\n========================================================');
    console.log(`ALL REAL-TIME TESTS PASSED: ${testPassed} passed, ${testFailed} failed.`);
    console.log('========================================================\n');
  } catch (err: any) {
    console.error('Test execution failed:', err);
  } finally {
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();
    if (clientA_tab2) clientA_tab2.disconnect();
    if (clientEve) clientEve.disconnect();
    server.close();
    await mongoose.disconnect();
    process.exit(testFailed > 0 ? 1 : 0);
  }
};

runRealTimeTests();
