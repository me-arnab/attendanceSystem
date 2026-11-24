import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { chatService } from '../../services/chatService';
import { connectSocket, disconnectSocket } from '../../services/socket';
import {
  IDirectoryUser,
  IConnectionRequestItem,
  IConnectedPerson,
  IConversationItem,
  IMessageItem,
} from '../../types/chat';
import {
  MessageSquare,
  Users,
  UserPlus,
  Search,
  Send,
  Pin,
  Archive,
  Volume2,
  VolumeX,
  Check,
  CheckCheck,
  Clock,
  MoreVertical,
  CornerUpLeft,
  Smile,
  Trash2,
  Edit2,
  X,
  UserMinus,
  ChevronLeft,
  Bell,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '👏'];

// Helper to normalize any ID representation (string, ObjectId object, or string with _id/id property)
const normalizeId = (idObj: any): string => {
  if (!idObj) return '';
  if (typeof idObj === 'string') return idObj;
  if (typeof idObj === 'object') {
    if (idObj._id) return String(idObj._id);
    if (idObj.id) return String(idObj.id);
    if (typeof idObj.toString === 'function') {
      const str = idObj.toString();
      if (str !== '[object Object]') return str;
    }
  }
  return String(idObj);
};

export const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Navigation tab in left sidebar: 'chats' | 'requests' | 'connections' | 'directory'
  const [activeTab, setActiveTab] = useState<'chats' | 'requests' | 'connections' | 'directory'>('chats');

  // Conversation & directory state
  const [conversations, setConversations] = useState<IConversationItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<IConversationItem | null>(null);
  const [messages, setMessages] = useState<IMessageItem[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<IDirectoryUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IConnectionRequestItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<IConnectionRequestItem[]>([]);
  const [connections, setConnections] = useState<IConnectedPerson[]>([]);

  // Search & Filters
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);

  // Active composer state
  const [messageInput, setMessageInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<IMessageItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<IMessageItem | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null); // messageId for message reaction or 'composer'
  const [otherUserTyping, setOtherUserTyping] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null); // messageId

  // Mobile navigation state
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Keep a stable ref to activeConversation for socket event handlers
  const activeConversationRef = useRef<IConversationItem | null>(null);
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  // Keep a stable ref to current user for socket event handlers
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Request browser notification permission politely (only on explicit demand, not automatically)
  const enableBrowserNotifications = async () => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        toast('Desktop notifications enabled!', 'success');
      }
    }
  };

  const showDesktopNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.ico' });
      } catch (e) {
        // Safe ignore
      }
    }
  };

  // Scroll messages to bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [messages]);

  // Initial Data Load
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [convs, inc, outg, conns] = await Promise.all([
        chatService.getConversations(),
        chatService.getIncomingRequests(),
        chatService.getOutgoingRequests(),
        chatService.getConnections(),
      ]);
      setConversations(convs);
      setIncomingRequests(inc);
      setOutgoingRequests(outg);
      setConnections(conns);
    } catch (err: any) {
      toast(err.message || 'Failed to load chat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Socket.IO event setup
  useEffect(() => {
    const socket = connectSocket();

    const onConnect = () => {
      console.log('[Socket] Connected as user', userRef.current?._id);
    };

    const onPresenceSnapshot = (data: { onlineUserIds: string[] }) => {
      const onlineSet = new Set(data.onlineUserIds);
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participant: {
            ...c.participant,
            isOnline: onlineSet.has(c.participant._id),
          },
        }))
      );
      setConnections((prev) =>
        prev.map((conn) => {
          if (!conn.user) return conn;
          return {
            ...conn,
            user: {
              ...conn.user,
              isOnline: onlineSet.has(conn.user._id),
            },
          };
        })
      );
      setDirectoryUsers((prev) =>
        prev.map((u) => ({
          ...u,
          isOnline: onlineSet.has(u._id),
        }))
      );
      setActiveConversation((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          participant: {
            ...prev.participant,
            isOnline: onlineSet.has(prev.participant._id),
          },
        };
      });
    };

    const onUserPresence = (data: { userId: string; status: 'online' | 'offline'; lastSeen: string }) => {
      const isOnline = data.status === 'online';
      setConversations((prev) =>
        prev.map((c) => {
          if (c.participant._id === data.userId) {
            return {
              ...c,
              participant: {
                ...c.participant,
                isOnline,
                lastSeen: data.lastSeen,
              },
            };
          }
          return c;
        })
      );
      setConnections((prev) =>
        prev.map((conn) => {
          if (conn.user && conn.user._id === data.userId) {
            return {
              ...conn,
              user: {
                ...conn.user,
                isOnline,
                lastSeen: data.lastSeen,
              },
            };
          }
          return conn;
        })
      );
      setDirectoryUsers((prev) =>
        prev.map((u) => {
          if (u._id === data.userId) {
            return {
              ...u,
              isOnline,
              lastSeen: data.lastSeen,
            };
          }
          return u;
        })
      );
      setActiveConversation((prev) => {
        if (prev && prev.participant._id === data.userId) {
          return {
            ...prev,
            participant: {
              ...prev.participant,
              isOnline,
              lastSeen: data.lastSeen,
            },
          };
        }
        return prev;
      });
    };

    // Real-time new message
    const onNewMessage = (msg: IMessageItem) => {
      const activeConv = activeConversationRef.current;
      const currentUser = userRef.current;

      // If belongs to active conversation, append immediately
      if (activeConv && msg.conversationId === activeConv._id) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        // If message was from the other user, mark read immediately
        if (msg.senderId !== currentUser?._id) {
          chatService.markConversationRead(activeConv._id);
          socket.emit('message:mark_read', { conversationId: activeConv._id });
        }
      }

      // Update conversations list preview & unread badges
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === msg.conversationId);
        if (idx >= 0) {
          const updated = [...prev];
          const conv = { ...updated[idx] };
          conv.lastMessage = {
            messageId: msg._id,
            senderId: msg.senderId,
            content: msg.content,
            createdAt: msg.createdAt,
            isDeletedForEveryone: false,
          };
          conv.lastActivityAt = msg.createdAt;
          if (!activeConv || activeConv._id !== msg.conversationId) {
            if (msg.senderId !== currentUser?._id) {
              conv.unreadCount = (conv.unreadCount || 0) + 1;
              showDesktopNotification(`New message from ${msg.senderName}`, msg.content);
            }
          }
          // Move to top
          updated.splice(idx, 1);
          return [conv, ...updated];
        } else {
          // Re-fetch conversations if brand new conversation just started
          chatService.getConversations().then(setConversations);
          return prev;
        }
      });
    };

    // Message edited
    const onMessageEdited = (data: { messageId: string; conversationId: string; content: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === data.messageId ? { ...m, content: data.content, isEdited: true } : m))
      );
      setConversations((prev) =>
        prev.map((c) => {
          if (c.lastMessage?.messageId === data.messageId) {
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                content: data.content,
              },
            };
          }
          return c;
        })
      );
    };

    // Message deleted for everyone
    const onMessageDeletedForEveryone = (data: { messageId: string; conversationId: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId
            ? { ...m, content: 'This message was deleted.', isDeletedForEveryone: true, reactions: [] }
            : m
        )
      );
      setConversations((prev) =>
        prev.map((c) => {
          if (c.lastMessage?.messageId === data.messageId) {
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                content: 'This message was deleted.',
                isDeletedForEveryone: true,
              },
            };
          }
          return c;
        })
      );
    };

    // Reaction update
    const onReactionUpdate = (data: { messageId: string; reactions: any[] }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === data.messageId ? { ...m, reactions: data.reactions } : m))
      );
    };

    // Read receipt
    const onReadReceipt = (data: { conversationId: string; readBy: string; readAt: string; messageIds?: string[] }) => {
      const activeConv = activeConversationRef.current;
      const currentUserId = normalizeId(userRef.current?._id || (userRef.current as any)?.id);

      if (activeConv && activeConv._id === data.conversationId) {
        setMessages((prev) =>
          prev.map((m) => {
            const senderId = normalizeId(m.senderId);
            const isTarget = data.messageIds && data.messageIds.length > 0
              ? data.messageIds.includes(m._id)
              : senderId === currentUserId;

            if (isTarget && m.status !== 'read') {
              return { ...m, status: 'read', readAt: data.readAt };
            }
            return m;
          })
        );
      }
    };

    // Typing updates
    const onTypingUpdate = (data: { conversationId: string; userId: string; userName: string; isTyping: boolean }) => {
      const activeConv = activeConversationRef.current;
      if (activeConv && activeConv._id === data.conversationId) {
        setOtherUserTyping(data.isTyping ? data.userName : null);
      }
    };

    // Connection events
    const onConnectionRequestReceived = (data: any) => {
      chatService.getIncomingRequests().then(setIncomingRequests);
      toast(`New connection request from ${data.requester.fullName}`, 'info');
      showDesktopNotification('New Connection Request', `${data.requester.fullName} sent you a connection request.`);
    };

    const onConnectionAccepted = () => {
      chatService.getConnections().then(setConnections);
      chatService.getOutgoingRequests().then(setOutgoingRequests);
      chatService.getConversations().then(setConversations);
      toast('Connection request accepted! You can now chat.', 'success');
    };

    const onConnectionDeclined = () => {
      chatService.getOutgoingRequests().then(setOutgoingRequests);
      toast('Your connection request was declined.', 'info');
    };

    const onConnectionClosed = () => {
      chatService.getConnections().then(setConnections);
      chatService.getConversations().then(setConversations);
      setActiveConversation((prev) => (prev ? { ...prev, isConnected: false, connectionStatus: 'CLOSED' } : null));
      toast('A connection was ended.', 'info');
    };

    socket.on('connect', onConnect);
    socket.on('presence:snapshot', onPresenceSnapshot);
    socket.on('user:presence', onUserPresence);
    socket.on('message:new', onNewMessage);
    socket.on('message:edited', onMessageEdited);
    socket.on('message:deleted_for_everyone', onMessageDeletedForEveryone);
    socket.on('message:reaction_update', onReactionUpdate);
    socket.on('message:read_receipt', onReadReceipt);
    socket.on('typing:update', onTypingUpdate);
    socket.on('connection:request_received', onConnectionRequestReceived);
    socket.on('connection:accepted', onConnectionAccepted);
    socket.on('connection:declined', onConnectionDeclined);
    socket.on('connection:closed', onConnectionClosed);

    return () => {
      socket.off('connect', onConnect);
      socket.off('presence:snapshot', onPresenceSnapshot);
      socket.off('user:presence', onUserPresence);
      socket.off('message:new', onNewMessage);
      socket.off('message:edited', onMessageEdited);
      socket.off('message:deleted_for_everyone', onMessageDeletedForEveryone);
      socket.off('message:reaction_update', onReactionUpdate);
      socket.off('message:read_receipt', onReadReceipt);
      socket.off('typing:update', onTypingUpdate);
      socket.off('connection:request_received', onConnectionRequestReceived);
      socket.off('connection:accepted', onConnectionAccepted);
      socket.off('connection:declined', onConnectionDeclined);
      socket.off('connection:closed', onConnectionClosed);
      disconnectSocket();
    };
  }, []);

  // Load Directory Users
  const handleLoadDirectory = async (search = '') => {
    try {
      const res = await chatService.getDirectory(search);
      setDirectoryUsers(res);
    } catch (err: any) {
      toast(err.message || 'Failed to search directory', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'directory') {
      handleLoadDirectory(sidebarSearch);
    }
  }, [activeTab, sidebarSearch]);

  // Open Conversation
  const handleSelectConversation = async (conv: IConversationItem) => {
    try {
      setActiveConversation(conv);
      setMobileShowChat(true);
      setLoadingMessages(true);
      setMessages([]);
      setReplyingTo(null);
      setEditingMessage(null);
      setOtherUserTyping(null);

      const res = await chatService.getMessages(conv._id);
      setMessages(res.messages);

      // Mark read
      if (conv.unreadCount > 0) {
        await chatService.markConversationRead(conv._id);
        const socket = connectSocket();
        socket.emit('message:mark_read', { conversationId: conv._id });

        setConversations((prev) =>
          prev.map((c) => (c._id === conv._id ? { ...c, unreadCount: 0 } : c))
        );
      }
    } catch (err: any) {
      toast(err.message || 'Failed to open conversation', 'error');
    } finally {
      setLoadingMessages(false);
    }
  };

  // Start chat with connected person or directory user
  const handleStartChatWithUser = async (targetUserId: string) => {
    try {
      const existing = conversations.find((c) => c.participant._id === targetUserId);
      if (existing) {
        handleSelectConversation(existing);
        setActiveTab('chats');
        return;
      }

      // Check if active connection exists
      const conns = await chatService.getConnections();
      const connected = conns.find((c) => c.user?._id === targetUserId);
      if (!connected) {
        toast('You must be connected with this user before messaging', 'error');
        return;
      }

      // Refresh conversations
      const allConvs = await chatService.getConversations();
      setConversations(allConvs);
      const newConv = allConvs.find((c) => c.participant._id === targetUserId);
      if (newConv) {
        handleSelectConversation(newConv);
        setActiveTab('chats');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to start chat', 'error');
    }
  };

  // Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !activeConversation) return;

    if (!activeConversation.isConnected) {
      toast('Cannot send message. You are not connected with this person.', 'error');
      return;
    }

    const content = messageInput.trim();
    const replyId = replyingTo?._id;

    // Clear input immediately for responsive UX
    setMessageInput('');
    setReplyingTo(null);

    // Stop typing indicator
    const socket = connectSocket();
    socket.emit('typing:stop', { conversationId: activeConversation._id });

    try {
      if (editingMessage) {
        await chatService.editMessage(editingMessage._id, content);
        setEditingMessage(null);
      } else {
        await chatService.sendMessage(activeConversation._id, content, replyId);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to send message', 'error');
      setMessageInput(content); // restore input on failure
    }
  };

  // Handle Typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    if (!activeConversation) return;

    const socket = connectSocket();
    socket.emit('typing:start', { conversationId: activeConversation._id });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId: activeConversation._id });
    }, 2000);
  };

  // Send Connection Request
  const handleSendRequest = async (recipientId: string) => {
    try {
      await chatService.sendConnectionRequest(recipientId);
      toast('Connection request sent!', 'success');
      handleLoadDirectory(sidebarSearch);
      const outg = await chatService.getOutgoingRequests();
      setOutgoingRequests(outg);
    } catch (err: any) {
      toast(err.message || 'Failed to send connection request', 'error');
    }
  };

  // Accept Request
  const handleAcceptRequest = async (connectionId: string) => {
    try {
      await chatService.acceptConnectionRequest(connectionId);
      toast('Connection request accepted!', 'success');
      const [inc, conns, convs] = await Promise.all([
        chatService.getIncomingRequests(),
        chatService.getConnections(),
        chatService.getConversations(),
      ]);
      setIncomingRequests(inc);
      setConnections(conns);
      setConversations(convs);
    } catch (err: any) {
      toast(err.message || 'Failed to accept request', 'error');
    }
  };

  // Decline Request
  const handleDeclineRequest = async (connectionId: string) => {
    try {
      await chatService.declineConnectionRequest(connectionId);
      toast('Connection request declined.', 'info');
      const inc = await chatService.getIncomingRequests();
      setIncomingRequests(inc);
    } catch (err: any) {
      toast(err.message || 'Failed to decline request', 'error');
    }
  };

  // Cancel Outgoing Request
  const handleCancelOutgoing = async (connectionId: string) => {
    try {
      await chatService.cancelOutgoingRequest(connectionId);
      toast('Connection request cancelled.', 'info');
      const outg = await chatService.getOutgoingRequests();
      setOutgoingRequests(outg);
      if (activeTab === 'directory') handleLoadDirectory(sidebarSearch);
    } catch (err: any) {
      toast(err.message || 'Failed to cancel request', 'error');
    }
  };

  // Unfriend
  const handleUnfriend = async (connectionId: string) => {
    if (!confirm('Are you sure you want to end this connection? Messaging will be disabled.')) return;
    try {
      await chatService.unfriendConnection(connectionId);
      toast('Connection ended.', 'info');
      const conns = await chatService.getConnections();
      setConnections(conns);
      const convs = await chatService.getConversations();
      setConversations(convs);
      if (activeConversation) {
        setActiveConversation((prev) => (prev ? { ...prev, isConnected: false, connectionStatus: 'CLOSED' } : null));
      }
    } catch (err: any) {
      toast(err.message || 'Failed to end connection', 'error');
    }
  };

  // Delete message for me
  const handleDeleteForMe = async (messageId: string) => {
    try {
      await chatService.deleteForMe(messageId);
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
      setActionMenuOpen(null);
      toast('Message removed for you', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to delete message', 'error');
    }
  };

  // Delete message for everyone
  const handleDeleteForEveryone = async (messageId: string) => {
    if (!confirm('Delete this message for everyone?')) return;
    try {
      await chatService.deleteForEveryone(messageId);
      setActionMenuOpen(null);
      toast('Message deleted for everyone', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to delete message', 'error');
    }
  };

  // Emoji reaction
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      setShowEmojiPicker(null);
      await chatService.toggleReaction(messageId, emoji);
    } catch (err: any) {
      toast(err.message || 'Failed to react', 'error');
    }
  };

  // Pin / Archive / Mute conversation
  const handleUpdatePreference = async (
    field: 'isPinned' | 'isArchived' | 'isMuted',
    val: boolean
  ) => {
    if (!activeConversation) return;
    try {
      await chatService.updatePreferences(activeConversation._id, { [field]: val });
      setActiveConversation((prev) => (prev ? { ...prev, [field]: val } : null));
      setConversations((prev) =>
        prev.map((c) => (c._id === activeConversation._id ? { ...c, [field]: val } : c))
      );
      toast(`Conversation ${field === 'isPinned' ? (val ? 'pinned' : 'unpinned') : field === 'isMuted' ? (val ? 'muted' : 'unmuted') : (val ? 'archived' : 'unarchived')}`, 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to update preferences', 'error');
    }
  };

  // Search messages in active conversation
  const handleSearchMessages = async () => {
    if (!messageSearchQuery.trim() || !activeConversation) return;
    try {
      const results = await chatService.searchMessages(messageSearchQuery, activeConversation._id);
      if (results.length === 0) {
        toast('No messages matched your query', 'info');
      } else {
        toast(`Found ${results.length} matching message(s)`, 'success');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to search messages', 'error');
    }
  };

  // Filter conversations
  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
  });

  const filteredConversations = sortedConversations.filter((c) => {
    if (sidebarSearch) {
      return (
        c.participant.fullName.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
        c.participant.designation?.toLowerCase().includes(sidebarSearch.toLowerCase())
      );
    }
    return !c.isArchived;
  });

  return (
    <div className="h-[calc(100vh-5rem)] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
      {/* LEFT SIDEBAR: Nav + List (Conversations / Requests / Connections / Directory) */}
      <div
        className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-slate-50/50 ${
          mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand-600" />
              Company Chat
            </h1>
            <button
              onClick={enableBrowserNotifications}
              title="Enable desktop notifications"
              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Pills */}
          <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'chats' ? 'bg-white text-brand-700 shadow-sm font-semibold' : 'hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chats
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 relative ${
                activeTab === 'requests' ? 'bg-white text-brand-700 shadow-sm font-semibold' : 'hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Requests
              {incomingRequests.length > 0 && (
                <span className="w-4 h-4 bg-brand-600 text-white rounded-full text-[10px] flex items-center justify-center">
                  {incomingRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('connections')}
              className={`flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'connections' ? 'bg-white text-brand-700 shadow-sm font-semibold' : 'hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              People
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className={`flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'directory' ? 'bg-white text-brand-700 shadow-sm font-semibold' : 'hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Find
            </button>
          </div>

          {/* Search bar */}
          <div className="mt-3 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder={
                activeTab === 'directory'
                  ? 'Search by name, employee ID, role...'
                  : 'Search conversations...'
              }
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-100/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Content list according to active tab */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <LoadingSpinner message="Loading..." />
            </div>
          ) : activeTab === 'chats' ? (
            /* CONVERSATIONS TAB */
            filteredConversations.length === 0 ? (
              <div className="text-center py-12 px-4 text-slate-400 text-sm">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No conversations yet</p>
                <p className="text-xs mt-1 text-slate-400">
                  Switch to <b>Find</b> or <b>People</b> to start chatting!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredConversations.map((conv) => {
                  const isSelected = activeConversation?._id === conv._id;
                  return (
                    <div
                      key={conv._id}
                      onClick={() => handleSelectConversation(conv)}
                      className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors relative ${
                        isSelected
                          ? 'bg-brand-50/70 border-l-4 border-brand-600'
                          : 'hover:bg-slate-100/60'
                      }`}
                    >
                      {/* Avatar with Presence Indicator */}
                      <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm uppercase">
                          {conv.participant.fullName.substring(0, 2)}
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                            conv.participant.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                          title={conv.participant.isOnline ? 'Online' : 'Offline'}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-semibold text-slate-800 truncate flex items-center gap-1.5">
                            {conv.participant.fullName}
                            {conv.isPinned && <Pin className="w-3 h-3 text-brand-600 fill-brand-600" />}
                            {conv.isMuted && <VolumeX className="w-3 h-3 text-slate-400" />}
                          </h4>
                          <span className="text-[11px] text-slate-400 flex-shrink-0">
                            {conv.lastMessage?.createdAt
                              ? new Date(conv.lastMessage.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-500 truncate max-w-[180px]">
                            {conv.lastMessage?.content || (
                              <span className="italic text-slate-400">No messages yet</span>
                            )}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="bg-brand-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : activeTab === 'requests' ? (
            /* REQUESTS TAB (Incoming & Outgoing) */
            <div className="p-3 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                  Incoming Requests ({incomingRequests.length})
                </h3>
                {incomingRequests.length === 0 ? (
                  <p className="text-xs text-slate-400 italic px-1">No incoming requests</p>
                ) : (
                  <div className="space-y-2">
                    {incomingRequests.map((req) => (
                      <div
                        key={req._id}
                        className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs uppercase">
                            {req.requesterId?.fullName?.substring(0, 2) || '??'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-semibold text-slate-800 truncate">
                              {req.requesterId?.fullName}
                            </h4>
                            <p className="text-[10px] text-slate-500 truncate">
                              {req.requesterId?.designation || req.requesterId?.departmentId?.name || 'Colleague'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleAcceptRequest(req._id)}
                            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-1 px-2 rounded text-xs font-medium transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleDeclineRequest(req._id)}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-1 px-2 rounded text-xs font-medium transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                  Sent Requests ({outgoingRequests.length})
                </h3>
                {outgoingRequests.length === 0 ? (
                  <p className="text-xs text-slate-400 italic px-1">No pending sent requests</p>
                ) : (
                  <div className="space-y-2">
                    {outgoingRequests.map((req) => (
                      <div
                        key={req._id}
                        className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs uppercase">
                            {req.recipientId?.fullName?.substring(0, 2) || '??'}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-slate-800 truncate">
                              {req.recipientId?.fullName}
                            </h4>
                            <p className="text-[10px] text-slate-400">Pending approval</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCancelOutgoing(req._id)}
                          className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'connections' ? (
            /* CONNECTED PEOPLE TAB */
            <div className="p-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                Connected People ({connections.length})
              </h3>
              {connections.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <p>You haven't connected with anyone yet.</p>
                  <p className="mt-1">Head to the Find tab to send requests!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {connections.map((conn) => {
                    if (!conn.user) return null;
                    return (
                      <div
                        key={conn._id}
                        className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between hover:border-brand-300 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs uppercase">
                              {conn.user.fullName.substring(0, 2)}
                            </div>
                            <span
                              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                                conn.user.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-slate-800 truncate">
                              {conn.user.fullName}
                            </h4>
                            <p className="text-[10px] text-slate-500 truncate">
                              {conn.user.designation || conn.user.department}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartChatWithUser(conn.user!._id)}
                            className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                            title="Chat"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleUnfriend(conn._id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Unfriend"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* DIRECTORY / FIND TAB */
            <div className="p-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                Company Directory ({directoryUsers.length})
              </h3>
              {directoryUsers.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-1">No colleagues found</p>
              ) : (
                <div className="space-y-2">
                  {directoryUsers.map((emp) => (
                    <div
                      key={emp._id}
                      className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between hover:border-brand-200 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs uppercase">
                            {emp.fullName.substring(0, 2)}
                          </div>
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                              emp.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-slate-800 truncate flex items-center gap-1">
                            {emp.fullName}
                            {emp.employeeId && (
                              <span className="text-[10px] text-slate-400">({emp.employeeId})</span>
                            )}
                          </h4>
                          <p className="text-[10px] text-slate-500 truncate">
                            {emp.designation || emp.department}
                          </p>
                        </div>
                      </div>

                      {/* Connection Action button */}
                      <div>
                        {emp.connectionStatus === 'ACCEPTED' ? (
                          <button
                            onClick={() => handleStartChatWithUser(emp._id)}
                            className="text-xs bg-brand-50 hover:bg-brand-100 text-brand-700 px-2.5 py-1 rounded-md font-medium flex items-center gap-1"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Chat
                          </button>
                        ) : emp.connectionStatus === 'PENDING' ? (
                          emp.isRequester ? (
                            <span className="text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200">
                              Sent
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                if (emp.connectionId) handleAcceptRequest(emp.connectionId);
                                else setActiveTab('requests');
                              }}
                              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-md font-medium"
                            >
                              Accept
                            </button>
                          )
                        ) : !emp.canSendRequest && emp.declineCooloffExpiresAt ? (
                          <span
                            className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md"
                            title={`Available after: ${new Date(emp.declineCooloffExpiresAt).toLocaleTimeString()}`}
                          >
                            Cooldown
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSendRequest(emp._id)}
                            className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-2.5 py-1 rounded-md font-medium flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" />
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONVERSATION AREA */}
      <div
        className={`flex-1 flex flex-col bg-white ${
          !mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activeConversation ? (
          <>
            {/* Conversation Header */}
            <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between bg-white z-10">
              <div className="flex items-center gap-3 min-w-0">
                {/* Back button for mobile */}
                <button
                  onClick={() => setMobileShowChat(false)}
                  className="p-1 -ml-1 text-slate-500 hover:text-slate-800 md:hidden"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                {/* Avatar */}
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm uppercase">
                    {activeConversation.participant.fullName.substring(0, 2)}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      activeConversation.participant.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                </div>

                {/* Info */}
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5">
                    {activeConversation.participant.fullName}
                    {activeConversation.participant.status === 'inactive' && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-normal">
                        Account Deactivated
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {activeConversation.participant.isOnline
                      ? 'Active now'
                      : activeConversation.participant.lastSeen
                      ? `Last seen ${new Date(activeConversation.participant.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Offline'}
                  </p>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleUpdatePreference('isPinned', !activeConversation.isPinned)}
                  className={`p-2 rounded-lg transition-colors ${
                    activeConversation.isPinned
                      ? 'text-brand-600 bg-brand-50'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                  title={activeConversation.isPinned ? 'Unpin Chat' : 'Pin Chat'}
                >
                  <Pin className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleUpdatePreference('isMuted', !activeConversation.isMuted)}
                  className={`p-2 rounded-lg transition-colors ${
                    activeConversation.isMuted
                      ? 'text-amber-600 bg-amber-50'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                  title={activeConversation.isMuted ? 'Unmute' : 'Mute'}
                >
                  {activeConversation.isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => handleUpdatePreference('isArchived', !activeConversation.isArchived)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Archive Chat"
                >
                  <Archive className="w-4 h-4" />
                </button>
                {activeConversation.isConnected && activeConversation.connectionId && (
                  <button
                    onClick={() => handleUnfriend(activeConversation.connectionId!)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Unfriend / Close Connection"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Connection Banner if closed/unfriended */}
            {!activeConversation.isConnected && (
              <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    You are not currently connected with this user. Past history is preserved, but new messages cannot be sent.
                  </span>
                </div>
                <button
                  onClick={() => handleSendRequest(activeConversation.participant._id)}
                  className="ml-2 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold whitespace-nowrap"
                >
                  Send Reconnect Request
                </button>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
              {loadingMessages ? (
                <div className="flex justify-center items-center h-48">
                  <LoadingSpinner message="Loading messages..." />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-20 text-slate-400 text-sm">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="font-medium text-slate-600">No messages in this conversation yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Say hello to start the conversation!
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const currentUserId = normalizeId(user?._id || (user as any)?.id);
                  const msgSenderId = normalizeId(msg.senderId);
                  const isMe = !!currentUserId && !!msgSenderId && currentUserId === msgSenderId;
                  const canEdit =
                    isMe &&
                    !msg.isDeletedForEveryone &&
                    (new Date().getTime() - new Date(msg.createdAt).getTime()) / (1000 * 60) <= 15;

                  return (
                    <div
                      key={msg._id}
                      className={`flex flex-col group w-full ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-end gap-1.5 max-w-[85%] md:max-w-[70%]">
                        {/* Hover Action Menu trigger for me/other */}
                        {isMe && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center relative">
                            <button
                              onClick={() => setActionMenuOpen(actionMenuOpen === msg._id ? null : msg._id)}
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {actionMenuOpen === msg._id && (
                              <div className="absolute right-0 bottom-6 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 w-36 text-xs">
                                {!msg.isDeletedForEveryone && (
                                  <button
                                    onClick={() => {
                                      setReplyingTo(msg);
                                      setActionMenuOpen(null);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-1.5"
                                  >
                                    <CornerUpLeft className="w-3.5 h-3.5 text-slate-500" />
                                    Reply
                                  </button>
                                )}
                                {canEdit && (
                                  <button
                                    onClick={() => {
                                      setEditingMessage(msg);
                                      setMessageInput(msg.content);
                                      setActionMenuOpen(null);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-1.5"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                    Edit (15 min)
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteForMe(msg._id)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                                  Delete for me
                                </button>
                                {!msg.isDeletedForEveryone && (
                                  <button
                                    onClick={() => handleDeleteForEveryone(msg._id)}
                                    className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-1.5"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    Delete for all
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bubble */}
                        <div
                          className={`rounded-2xl px-3.5 py-2 relative shadow-xs ${
                            isMe
                              ? 'bg-brand-600 text-white rounded-br-xs'
                              : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                          }`}
                        >
                          {/* Reply Quote preview */}
                          {msg.replyTo && (
                            <div
                              className={`mb-1.5 px-2.5 py-1 rounded border-l-2 text-xs ${
                                isMe
                                  ? 'bg-brand-700/60 border-brand-300 text-brand-100'
                                  : 'bg-slate-100 border-brand-500 text-slate-600'
                              }`}
                            >
                              <p className="font-semibold text-[11px]">
                                {normalizeId(msg.replyTo.senderId) === currentUserId
                                  ? 'You'
                                  : activeConversation.participant.fullName}
                              </p>
                              <p className="truncate italic">
                                {msg.replyTo.isDeleted
                                  ? 'This message was deleted.'
                                  : msg.replyTo.content}
                              </p>
                            </div>
                          )}

                          {/* Message Content */}
                          <p
                            className={`text-sm break-words whitespace-pre-wrap ${
                              msg.isDeletedForEveryone ? 'italic opacity-70 text-xs' : ''
                            }`}
                          >
                            {msg.content}
                          </p>

                          {/* Meta: time, edited, delivery/read receipt */}
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                              isMe ? 'text-brand-200' : 'text-slate-400'
                            }`}
                          >
                            {msg.isEdited && <span>(edited)</span>}
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isMe && !msg.isDeletedForEveryone && (
                              <span title={`Status: ${msg.status}`}>
                                {msg.status === 'read' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                                ) : msg.status === 'delivered' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-slate-300" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-slate-300" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions for messages from other user */}
                        {!isMe && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center relative">
                            <button
                              onClick={() => setShowEmojiPicker(showEmojiPicker === msg._id ? null : msg._id)}
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded"
                              title="React"
                            >
                              <Smile className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setReplyingTo(msg)}
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded"
                              title="Reply"
                            >
                              <CornerUpLeft className="w-3.5 h-3.5" />
                            </button>

                            {/* Reaction Picker Popover */}
                            {showEmojiPicker === msg._id && !msg.isDeletedForEveryone && (
                              <div className="absolute left-0 bottom-6 bg-white border border-slate-200 shadow-md rounded-full px-2 py-1 flex gap-1 z-20">
                                {EMOJI_OPTIONS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleToggleReaction(msg._id, emoji)}
                                    className="hover:scale-125 transition-transform text-base"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Render Reactions */}
                      {msg.reactions && msg.reactions.length > 0 && !msg.isDeletedForEveryone && (
                        <div className="flex gap-1 mt-1 -mb-1 px-1">
                          {Array.from(new Set(msg.reactions.map((r) => r.emoji))).map((emoji) => {
                            const count = msg.reactions.filter((r) => r.emoji === emoji).length;
                            const reactedByMe = msg.reactions.some(
                              (r) => r.emoji === emoji && normalizeId(r.userId) === currentUserId
                            );
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(msg._id, emoji)}
                                className={`text-[11px] px-1.5 py-0.5 rounded-full border flex items-center gap-1 shadow-2xs ${
                                  reactedByMe
                                    ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold'
                                    : 'bg-white border-slate-200 text-slate-600'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span>{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator */}
            {otherUserTyping && (
              <div className="px-4 py-1 text-xs text-slate-400 italic flex items-center gap-1.5 bg-slate-50 border-t border-slate-100">
                <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                {otherUserTyping} is typing...
              </div>
            )}

            {/* Replying or Editing Banner */}
            {(replyingTo || editingMessage) && (
              <div className="px-4 py-2 bg-slate-100/80 border-t border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  {replyingTo ? (
                    <>
                      <CornerUpLeft className="w-4 h-4 text-brand-600 flex-shrink-0" />
                      <span className="font-semibold text-slate-700">Replying to:</span>
                      <span className="truncate text-slate-600">{replyingTo.content}</span>
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
                      <span className="font-semibold text-slate-700">Editing message</span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setEditingMessage(null);
                    setMessageInput('');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Message Composer */}
            <div className="p-3 border-t border-slate-200 bg-white">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                {/* Emoji button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(showEmojiPicker === 'composer' ? null : 'composer')}
                    className="p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  {showEmojiPicker === 'composer' && (
                    <div className="absolute bottom-10 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-2 flex gap-1 z-30">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setMessageInput((prev) => prev + emoji);
                            setShowEmojiPicker(null);
                          }}
                          className="hover:scale-125 transition-transform text-lg"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    activeConversation.isConnected
                      ? 'Type a message... (Enter to send, Shift+Enter for new line)'
                      : 'Messaging disabled (not connected)'
                  }
                  disabled={!activeConversation.isConnected}
                  className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white disabled:opacity-50 disabled:bg-slate-100"
                />

                <Button
                  type="submit"
                  disabled={!messageInput.trim() || !activeConversation.isConnected}
                  size="md"
                  className="px-4"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          /* Empty state when no conversation is selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
            <div className="w-16 h-16 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Company Chat</h3>
            <p className="text-sm text-slate-500 max-w-sm mb-6">
              Connect with colleagues within your organization, send connection requests, and chat in real time.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setActiveTab('directory')} variant="primary" size="sm">
                <Search className="w-4 h-4 mr-1.5" />
                Find Colleagues
              </Button>
              <Button onClick={() => setActiveTab('requests')} variant="outline" size="sm">
                <UserPlus className="w-4 h-4 mr-1.5" />
                View Requests
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
