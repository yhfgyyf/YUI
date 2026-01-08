import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { Conversation, Message, ModelSettings, UIPreferences, AppState, ModelSource } from '@/types';
import { saveToLocalStorage, loadFromLocalStorage } from '@/utils/storage';

const DEFAULT_SETTINGS: ModelSettings = {
  model: 'Qwen3-30B',
  temperature: 0.7,
  top_p: 1.0,
  max_tokens: undefined,
  system: undefined,
};

const DEFAULT_UI_PREFERENCES: UIPreferences = {
  theme: 'light',
  fontSize: 'medium',
  messageDensity: 'comfortable',
  sidebarWidth: 280,
};

interface ChatStore extends AppState {
  // Conversation actions
  createConversation: () => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  selectConversation: (id: string) => void;
  pinConversation: (id: string) => void;
  archiveConversation: (id: string) => void;
  forkConversation: (conversationId: string, fromMessageId: string) => void;

  // Message actions
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'createdAt'>) => Message;
  updateMessage: (conversationId: string, messageId: string, updates: string | Partial<Pick<Message, 'content' | 'reasoning_content'>>) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  regenerateMessage: (conversationId: string, messageId: string) => void;

  // Settings actions
  updateGlobalSettings: (settings: Partial<ModelSettings>) => void;
  updateConversationSettings: (conversationId: string, settings: Partial<ModelSettings>) => void;
  updateUIPreferences: (preferences: Partial<UIPreferences>) => void;

  // Generation state
  setIsGenerating: (isGenerating: boolean) => void;

  // Model Source actions
  modelSources: ModelSource[];
  addModelSource: (source: Omit<ModelSource, 'id' | 'createdAt' | 'updatedAt' | 'models'>) => string;
  updateModelSource: (id: string, source: Partial<ModelSource>) => void;
  deleteModelSource: (id: string) => void;
  getModelSource: (id: string) => ModelSource | undefined;

  // Import/Export
  exportConversation: (id: string) => string;
  exportAllConversations: () => string;
  importConversations: (json: string) => void;

  // Utilities
  getCurrentConversation: () => Conversation | null;
  getEffectiveSettings: (conversationId: string) => ModelSettings;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentConversationId: null,
      globalSettings: DEFAULT_SETTINGS,
      uiPreferences: DEFAULT_UI_PREFERENCES,
      isGenerating: false,
      modelSources: [],

      createConversation: () => {
        const id = nanoid();
        const newConversation: Conversation = {
          id,
          title: 'New Chat',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
        };

        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          currentConversationId: id,
        }));

        return id;
      },

      deleteConversation: (id) => {
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          currentConversationId:
            state.currentConversationId === id
              ? state.conversations[0]?.id || null
              : state.currentConversationId,
        }));
      },

      renameConversation: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c
          ),
        }));
      },

      selectConversation: (id) => {
        set({ currentConversationId: id });
      },

      pinConversation: (id) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, isPinned: !c.isPinned } : c
          ),
        }));
      },

      archiveConversation: (id) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, isArchived: !c.isArchived } : c
          ),
        }));
      },

      forkConversation: (conversationId, fromMessageId) => {
        const state = get();
        const conversation = state.conversations.find((c) => c.id === conversationId);
        if (!conversation) return;

        const messageIndex = conversation.messages.findIndex((m) => m.id === fromMessageId);
        if (messageIndex === -1) return;

        const newId = nanoid();
        const forkedConversation: Conversation = {
          ...conversation,
          id: newId,
          title: `${conversation.title} (Fork)`,
          messages: conversation.messages.slice(0, messageIndex + 1),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          conversations: [forkedConversation, ...state.conversations],
          currentConversationId: newId,
        }));
      },

      addMessage: (conversationId, message) => {
        const newMessage: Message = {
          ...message,
          id: nanoid(),
          createdAt: Date.now(),
        };

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: [...c.messages, newMessage],
                  updatedAt: Date.now(),
                  // Auto-generate title from first user message
                  title:
                    c.messages.length === 0 && message.role === 'user'
                      ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
                      : c.title,
                }
              : c
          ),
        }));

        return newMessage;
      },

      updateMessage: (conversationId, messageId, updates) => {
        // 兼容字符串参数（向后兼容）
        const messageUpdates = typeof updates === 'string' ? { content: updates } : updates;

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, ...messageUpdates } : m
                  ),
                  updatedAt: Date.now(),
                }
              : c
          ),
        }));
      },

      deleteMessage: (conversationId, messageId) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.filter((m) => m.id !== messageId),
                  updatedAt: Date.now(),
                }
              : c
          ),
        }));
      },

      regenerateMessage: (conversationId, messageId) => {
        // This will be handled by the chat service
        // Just remove the message and all messages after it
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const messageIndex = c.messages.findIndex((m) => m.id === messageId);
            if (messageIndex === -1) return c;
            return {
              ...c,
              messages: c.messages.slice(0, messageIndex),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      updateGlobalSettings: (settings) => {
        set((state) => ({
          globalSettings: { ...state.globalSettings, ...settings },
        }));
      },

      updateConversationSettings: (conversationId, settings) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, settings: { ...c.settings, ...settings } }
              : c
          ),
        }));
      },

      updateUIPreferences: (preferences) => {
        set((state) => ({
          uiPreferences: { ...state.uiPreferences, ...preferences },
        }));
      },

      setIsGenerating: (isGenerating) => {
        set({ isGenerating });
      },

      exportConversation: (id) => {
        const conversation = get().conversations.find((c) => c.id === id);
        if (!conversation) throw new Error('Conversation not found');
        return JSON.stringify(conversation, null, 2);
      },

      exportAllConversations: () => {
        const data = {
          conversations: get().conversations,
          globalSettings: get().globalSettings,
          exportedAt: Date.now(),
        };
        return JSON.stringify(data, null, 2);
      },

      importConversations: (json) => {
        try {
          const data = JSON.parse(json);

          // Handle single conversation import
          if (data.id && data.messages) {
            set((state) => ({
              conversations: [data, ...state.conversations],
            }));
            return;
          }

          // Handle bulk import
          if (data.conversations && Array.isArray(data.conversations)) {
            set((state) => ({
              conversations: [...data.conversations, ...state.conversations],
              globalSettings: data.globalSettings || state.globalSettings,
            }));
            return;
          }

          throw new Error('Invalid import format');
        } catch (error) {
          throw new Error('Failed to import: Invalid JSON format');
        }
      },

      getCurrentConversation: () => {
        const state = get();
        return (
          state.conversations.find((c) => c.id === state.currentConversationId) || null
        );
      },

      getEffectiveSettings: (conversationId) => {
        const state = get();
        const conversation = state.conversations.find((c) => c.id === conversationId);
        return {
          ...state.globalSettings,
          ...conversation?.settings,
        };
      },

      addModelSource: (source) => {
        const id = nanoid();
        const newSource: ModelSource = {
          ...source,
          id,
          models: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          modelSources: [...state.modelSources, newSource],
        }));

        return id;
      },

      updateModelSource: (id, source) => {
        set((state) => ({
          modelSources: state.modelSources.map((s) =>
            s.id === id ? { ...s, ...source, updatedAt: Date.now() } : s
          ),
        }));
      },

      deleteModelSource: (id) => {
        set((state) => ({
          modelSources: state.modelSources.filter((s) => s.id !== id),
        }));
      },

      getModelSource: (id) => {
        return get().modelSources.find((s) => s.id === id);
      },
    }),
    {
      name: 'chatbox-storage',
      partialize: (state) => ({
        conversations: state.conversations,
        globalSettings: state.globalSettings,
        uiPreferences: state.uiPreferences,
        currentConversationId: state.currentConversationId,
        modelSources: state.modelSources,
      }),
    }
  )
);
