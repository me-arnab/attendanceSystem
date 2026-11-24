import { z } from 'zod';

export const directorySearchSchema = z.object({
  search: z.string().optional(),
  departmentId: z.string().optional(),
});

export const sendRequestSchema = z.object({
  recipientId: z.string().min(1, 'Recipient ID is required'),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required'),
  content: z.string().min(1, 'Message content cannot be empty').max(5000, 'Message is too long'),
  replyToMessageId: z.string().optional(),
});

export const editMessageSchema = z.object({
  content: z.string().min(1, 'Message content cannot be empty').max(5000, 'Message is too long'),
});

export const reactionSchema = z.object({
  emoji: z.enum(['👍', '❤️', '😂', '😮', '😢', '👏']),
});

export const conversationPreferenceSchema = z.object({
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  isMuted: z.boolean().optional(),
});
