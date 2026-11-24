import http from 'http';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { connectDB } from '../config/db';
import { ENV } from '../config/env';
import { initSocketIO } from '../socket';
import { User } from '../models/User';
import { Company } from '../models/Company';
import { Connection } from '../models/Connection';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';

const PORT = 5052;
const BASE_URL = `http://localhost:${PORT}/api`;

const runChatTests = async () => {
  console.log('========================================================');
  console.log('   STARTING AUTOMATED CHAT & CONNECTION TEST SUITE');
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

  try {
    // Clean up any test users/companies from prior runs
    const testCompanyCode = 'CHATTEST_' + Date.now();
    const otherCompanyCode = 'OTHERCOMP_' + Date.now();

    // 1. Create 2 test companies (to test tenant isolation)
    const companyA = await Company.create({
      name: 'Chat Test Inc',
      code: testCompanyCode,
      email: `admin_${Date.now()}@chattest.com`,
      phone: '1234567890',
      address: '123 Test St',
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
      name: 'Other Company Inc',
      code: otherCompanyCode,
      email: `admin_${Date.now()}@othercomp.com`,
      phone: '9876543210',
      address: '456 Other St',
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

    // 2. Create Users in Company A
    const password = 'Password@123';
    const userAdminA = await User.create({
      fullName: 'Alice Admin',
      email: `alice_${Date.now()}@chattest.com`,
      password,
      role: 'COMPANY_ADMIN',
      status: 'active',
      companyId: companyA._id,
      designation: 'Managing Director',
    });

    const userEmp1 = await User.create({
      fullName: 'Bob Developer',
      email: `bob_${Date.now()}@chattest.com`,
      password,
      role: 'EMPLOYEE',
      status: 'active',
      companyId: companyA._id,
      employeeId: 'EMP001',
      designation: 'Senior Engineer',
    });

    const userCharlie = await User.create({
      fullName: 'Charlie Designer',
      email: `charlie_${Date.now()}@chattest.com`,
      password,
      role: 'EMPLOYEE',
      status: 'active',
      companyId: companyA._id,
      employeeId: 'EMP002',
      designation: 'Lead UI Designer',
    });

    const userEmpDeactivated = await User.create({
      fullName: 'Dave Inactive',
      email: `dave_${Date.now()}@chattest.com`,
      password,
      role: 'EMPLOYEE',
      status: 'inactive',
      companyId: companyA._id,
      employeeId: 'EMP003',
      designation: 'Former Support',
    });

    // Create User in Company B (cross-company)
    const userCompanyB = await User.create({
      fullName: 'Eve Outside',
      email: `eve_${Date.now()}@othercomp.com`,
      password,
      role: 'EMPLOYEE',
      status: 'active',
      companyId: companyB._id,
      employeeId: 'EMP_B1',
      designation: 'Auditor',
    });

    // 3. Authenticate and get JWTs
    const login = async (email: string) => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      return data.data.token;
    };

    const tokenAlice = await login(userAdminA.email);
    const tokenBob = await login(userEmp1.email);
    const tokenCharlie = await login(userCharlie.email);
    const tokenEve = await login(userCompanyB.email);

    console.log('\n--- 1. DIRECTORY & ELIGIBLE USERS TESTS ---');
    // Bob searches directory
    const dirRes = await fetch(`${BASE_URL}/chat/directory`, {
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    const dirData = await dirRes.json();
    assert(dirData.success === true, 'Directory search succeeded');
    assert(
      dirData.data.some((u: any) => u._id === userAdminA._id.toString()),
      'Directory includes Company Admin (Alice)'
    );
    assert(
      dirData.data.some((u: any) => u._id === userCharlie._id.toString()),
      'Directory includes fellow Employee (Charlie)'
    );
    assert(
      !dirData.data.some((u: any) => u._id === userCompanyB._id.toString()),
      'Cross-company isolation: Eve (Company B) is NOT visible in Company A directory'
    );
    assert(
      !dirData.data.some((u: any) => u._id === userEmpDeactivated._id.toString()),
      'Deactivated accounts are excluded from search directory'
    );

    console.log('\n--- 2. CONNECTION REQUESTS: BOB -> CHARLIE ---');
    // Bob sends request to Charlie
    const sendReqRes = await fetch(`${BASE_URL}/chat/connections/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ recipientId: userCharlie._id.toString() }),
    });
    const sendReqData = await sendReqRes.json();
    assert(sendReqData.success === true, 'Connection request sent successfully');
    assert(sendReqData.data.status === 'PENDING', 'Connection status is PENDING');
    const connectionId = sendReqData.data._id;

    // Duplicate request prevention
    const dupReqRes = await fetch(`${BASE_URL}/chat/connections/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ recipientId: userCharlie._id.toString() }),
    });
    const dupReqData = await dupReqRes.json();
    assert(dupReqData.success === false, 'Duplicate pending request correctly blocked');

    // Cross-company connection request blocked
    const crossReqRes = await fetch(`${BASE_URL}/chat/connections/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ recipientId: userCompanyB._id.toString() }),
    });
    const crossReqData = await crossReqRes.json();
    assert(crossReqData.success === false, 'Cross-company request blocked with 404/error');

    // Self-request blocked
    const selfReqRes = await fetch(`${BASE_URL}/chat/connections/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ recipientId: userEmp1._id.toString() }),
    });
    const selfReqData = await selfReqRes.json();
    assert(selfReqData.success === false, 'Self-connection request correctly rejected');

    console.log('\n--- 3. DECLINE & 24-HOUR RESTRICTION TESTS ---');
    // Charlie declines Bob's request
    const declineRes = await fetch(`${BASE_URL}/chat/connections/${connectionId}/decline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCharlie}` },
    });
    const declineData = await declineRes.json();
    assert(declineData.success === true, 'Charlie declined request');
    assert(declineData.data.status === 'DECLINED', 'Status transitioned to DECLINED');

    // Bob tries to re-send request immediately (< 24 hours)
    const retryRes = await fetch(`${BASE_URL}/chat/connections/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ recipientId: userCharlie._id.toString() }),
    });
    const retryData = await retryRes.json();
    assert(retryData.success === false, '24-hour retry restriction enforced after decline');
    assert(retryData.error.includes('24-hour'), 'Error explains 24-hour cooloff period');

    // Simulate 24 hours passing by updating declinedAt back 25 hours
    await Connection.findByIdAndUpdate(connectionId, {
      declinedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });

    // Bob tries again after simulated 25 hours
    const retryAfter24hRes = await fetch(`${BASE_URL}/chat/connections/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ recipientId: userCharlie._id.toString() }),
    });
    const retryAfter24hData = await retryAfter24hRes.json();
    assert(retryAfter24hData.success === true, 'Request successfully allowed after 24 hours pass');
    const newConnectionId = retryAfter24hData.data._id;

    console.log('\n--- 4. ACCEPT CONNECTION & START MESSAGING ---');
    // Charlie accepts Bob's request
    const acceptRes = await fetch(`${BASE_URL}/chat/connections/${newConnectionId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCharlie}` },
    });
    const acceptData = await acceptRes.json();
    assert(acceptData.success === true, 'Charlie accepted connection request');
    assert(acceptData.data.connection.status === 'ACCEPTED', 'Status transitioned to ACCEPTED');
    const conversationId = acceptData.data.conversationId;
    assert(!!conversationId, 'Conversation automatically created/linked on accept');

    // Connected list
    const connsRes = await fetch(`${BASE_URL}/chat/connections`, {
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    const connsData = await connsRes.json();
    assert(
      connsData.data.some((c: any) => c.user._id === userCharlie._id.toString()),
      'Charlie is now in Bob\'s connected people list'
    );

    console.log('\n--- 5. MESSAGING: SEND, REPLY, EDIT, REACTIONS, READ RECEIPTS ---');
    // 5a. Non-connected messaging attempt (Alice tries to message Bob without connection)
    const unauthorizedMsgRes = await fetch(`${BASE_URL}/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ conversationId, content: 'Hey Bob!' }),
    });
    const unauthorizedMsgData = await unauthorizedMsgRes.json();
    assert(unauthorizedMsgData.success === false, 'Unauthorized non-participant rejected from messaging in conversation');

    // 5b. Bob sends message to Charlie
    const sendMsgRes = await fetch(`${BASE_URL}/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ conversationId, content: 'Hello Charlie! Welcome to the team.' }),
    });
    const sendMsgData = await sendMsgRes.json();
    assert(sendMsgData.success === true, 'Bob sent message successfully');
    assert(sendMsgData.data.content === 'Hello Charlie! Welcome to the team.', 'Message content matches');
    const msg1Id = sendMsgData.data._id;

    // 5c. Charlie replies to Bob's message
    const replyRes = await fetch(`${BASE_URL}/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCharlie}` },
      body: JSON.stringify({
        conversationId,
        content: 'Thanks Bob! Excited to be here.',
        replyToMessageId: msg1Id,
      }),
    });
    const replyData = await replyRes.json();
    assert(replyData.success === true, 'Charlie replied to message successfully');
    assert(replyData.data.replyTo?.messageId === msg1Id, 'Reply reference preserves quoted message ID');
    const replyMsgId = replyData.data._id;

    // 5d. Charlie reacts to Bob's message with ❤️
    const reactRes = await fetch(`${BASE_URL}/chat/messages/${msg1Id}/reaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCharlie}` },
      body: JSON.stringify({ emoji: '❤️' }),
    });
    const reactData = await reactRes.json();
    assert(reactData.success === true, 'Charlie added ❤️ emoji reaction');
    assert(reactData.data.reactions[0].emoji === '❤️', 'Reaction correctly recorded');

    // 5e. Bob edits message within 15 minutes
    const editRes = await fetch(`${BASE_URL}/chat/messages/${msg1Id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ content: 'Hello Charlie! Welcome to our great team! (edited)' }),
    });
    const editData = await editRes.json();
    assert(editData.success === true, 'Message edit within 15 minutes allowed');
    assert(editData.data.isEdited === true, 'isEdited flag set to true');

    // 5f. Simulate 16 minutes passing -> edit must be rejected
    await Message.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(msg1Id) },
      { $set: { createdAt: new Date(Date.now() - 16 * 60 * 1000) } }
    );
    const lateEditRes = await fetch(`${BASE_URL}/chat/messages/${msg1Id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ content: 'Attempting late edit' }),
    });
    const lateEditData = await lateEditRes.json();
    assert(lateEditData.success === false, 'Editing after 15 minutes strictly rejected by backend');

    // 5g. Mark messages as read
    const readRes = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCharlie}` },
    });
    const readData = await readRes.json();
    assert(readData.success === true, 'Messages marked as read successfully');

    const updatedMsg = await Message.findById(msg1Id);
    assert(updatedMsg?.status === 'read', 'Message status updated to read in database');

    console.log('\n--- 6. MESSAGE DELETION TESTS ---');
    // 6a. Delete for me (Charlie deletes Bob's msg1 for himself)
    const delMeRes = await fetch(`${BASE_URL}/chat/messages/${msg1Id}/me`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenCharlie}` },
    });
    const delMeData = await delMeRes.json();
    assert(delMeData.success === true, 'Delete for me succeeded');

    // Verify Bob still sees it
    const bobMsgsRes = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    const bobMsgsData = await bobMsgsRes.json();
    assert(
      bobMsgsData.data.messages.some((m: any) => m._id === msg1Id),
      'Bob still sees msg1 after Charlie used Delete For Me'
    );

    // Verify Charlie does NOT see it
    const charlieMsgsRes = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${tokenCharlie}` },
    });
    const charlieMsgsData = await charlieMsgsRes.json();
    assert(
      !charlieMsgsData.data.messages.some((m: any) => m._id === msg1Id),
      'Charlie no longer sees msg1 in his message list'
    );

    // 6b. Delete for everyone (Charlie deletes his reply for everyone)
    const delAllRes = await fetch(`${BASE_URL}/chat/messages/${replyMsgId}/everyone`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenCharlie}` },
    });
    const delAllData = await delAllRes.json();
    assert(delAllData.success === true, 'Delete for everyone succeeded');

    // Both users should now see "This message was deleted."
    const bobMsgsAfterDel = await (
      await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${tokenBob}` },
      })
    ).json();
    const deletedMsgItem = bobMsgsAfterDel.data.messages.find((m: any) => m._id === replyMsgId);
    assert(deletedMsgItem?.content === 'This message was deleted.', 'Masked with "This message was deleted."');
    assert(deletedMsgItem?.isDeletedForEveryone === true, 'isDeletedForEveryone flag is true');

    console.log('\n--- 7. UNFRIEND & CONVERSATION PRESERVATION TESTS ---');
    // Charlie unfriends Bob
    const unfriendRes = await fetch(`${BASE_URL}/chat/connections/${newConnectionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenCharlie}` },
    });
    const unfriendData = await unfriendRes.json();
    assert(unfriendData.success === true, 'Connection ended / unfriended');

    // Verify messaging is now blocked
    const blockedMsgRes = await fetch(`${BASE_URL}/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ conversationId, content: 'Can we still talk?' }),
    });
    const blockedMsgData = await blockedMsgRes.json();
    assert(blockedMsgData.success === false, 'New messages blocked when unfriended');

    // Verify conversation history remains accessible
    const historyRes = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    const historyData = await historyRes.json();
    assert(historyData.success === true, 'Conversation history remains preserved after unfriend');
    assert(historyData.data.messages.length > 0, 'Past messages are still intact');

    console.log('\n--- 8. SIMULTANEOUS RECIPROCAL CONNECTION REQUESTS (FACEBOOK-STYLE) ---');
    // Scenario: User Alice sends request to Charlie
    const req1Res = await fetch(`${BASE_URL}/chat/connections/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ recipientId: userCharlie._id.toString() }),
    });
    const req1 = await req1Res.json();
    assert(req1.success === true, 'Alice sent request to Charlie (PENDING)');
    assert(req1.data.status === 'PENDING', 'Initial connection status remains PENDING');
    const aliceCharlieConnId = req1.data._id;

    // Charlie also sends request to Alice (reciprocal request)
    // Business rule: DO NOT automatically accept either request or establish connection!
    const req2Res = await fetch(`${BASE_URL}/chat/connections/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCharlie}` },
      body: JSON.stringify({ recipientId: userAdminA._id.toString() }),
    });
    const req2 = await req2Res.json();
    assert(req2.success === false, 'Reciprocal request rejected without auto-connecting');
    assert(
      req2.error.includes('already sent you a connection request') || req2.error.includes('pending'),
      'Backend explains that an incoming request is already waiting for acceptance/decline'
    );

    // Verify in database: exactly ONE connection record exists, and it is STILL PENDING
    const pairKeyAC = `${userAdminA._id.toString() < userCharlie._id.toString() ? userAdminA._id : userCharlie._id}:${userAdminA._id.toString() < userCharlie._id.toString() ? userCharlie._id : userAdminA._id}`;
    const connInDb = await Connection.findOne({ companyId: companyA._id, pairKey: pairKeyAC });
    assert(!!connInDb, 'Exactly one connection record exists for Alice and Charlie');
    assert(connInDb?.status === 'PENDING', 'Connection is STILL strictly PENDING (no implicit consent)');

    // Verify neither user can send messages before explicit acceptance
    let convAC = await Conversation.findOne({ companyId: companyA._id, pairKey: pairKeyAC });
    if (!convAC) {
      convAC = await Conversation.create({
        companyId: companyA._id,
        pairKey: pairKeyAC,
        participants: [userAdminA._id, userCharlie._id],
      });
    }
    const preAcceptMsgRes = await fetch(`${BASE_URL}/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ conversationId: convAC._id, content: 'Messaging before accept' }),
    });
    const preAcceptMsgData = await preAcceptMsgRes.json();
    assert(preAcceptMsgData.success === false, 'Messaging before explicit acceptance is strictly rejected (HTTP 403)');

    // Now Charlie explicitly ACCEPTS Alice's incoming request
    const explicitAcceptRes = await fetch(`${BASE_URL}/chat/connections/${aliceCharlieConnId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCharlie}` },
    });
    const explicitAcceptData = await explicitAcceptRes.json();
    assert(explicitAcceptData.success === true, 'Charlie explicitly accepted Alice\'s request');
    assert(explicitAcceptData.data.connection.status === 'ACCEPTED', 'Status transitioned to ACCEPTED only upon explicit action');

    // Verify messaging is now allowed after explicit acceptance
    const postAcceptMsgRes = await fetch(`${BASE_URL}/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ conversationId: explicitAcceptData.data.conversationId, content: 'Hello Charlie after explicit acceptance!' }),
    });
    const postAcceptMsgData = await postAcceptMsgRes.json();
    assert(postAcceptMsgData.success === true, 'Messaging permitted immediately after explicit acceptance');

    console.log('\n--- 9. SECURITY & RBAC CONSTRAINTS ---');
    // Super Admin cannot access chat routes
    const saLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@saas.com', password: 'Admin@12345' }),
    });
    const saData = await saLoginRes.json();
    if (saData.success) {
      const saToken = saData.data.token;
      const saChatRes = await fetch(`${BASE_URL}/chat/directory`, {
        headers: { Authorization: `Bearer ${saToken}` },
      });
      const saChatData = await saChatRes.json();
      assert(saChatRes.status === 403, 'Super Admin blocked from chat with 403');
    }

    // Company Admin cannot read private employee conversations they are not part of
    const adminReadPrivateRes = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert(adminReadPrivateRes.status === 404, 'Company Admin cannot read private conversations of other employees');

    console.log('\n========================================================');
    console.log(`ALL AUTOMATED TESTS PASSED: ${testPassed} passed, ${testFailed} failed.`);
    console.log('========================================================\n');
  } catch (err: any) {
    console.error('Test execution failed:', err);
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(testFailed > 0 ? 1 : 0);
  }
};

runChatTests();
