import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Conversation, Message, ModelSettings, UIPreferences, AppState, ModelSource, Folder } from '@/types';
import * as dbApi from '@/services/dbApi';

const DEFAULT_SETTINGS: ModelSettings = {
  model: '', // 默认空，需要用户手动选择或自动从可用模型中选择
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
  sidebarCollapsed: false,
};

interface ChatStore extends AppState {
  // Data loading state
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  loadFromDatabase: () => Promise<void>;

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

  // Folder actions
  folders: Folder[];
  createFolder: (name: string, color?: string) => string;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  moveConversationToFolder: (conversationId: string, folderId: string) => void;
  copyConversation: (id: string) => Promise<string>;

  // Import/Export
  exportConversation: (id: string) => string;
  exportAllConversations: () => string;
  importConversations: (json: string) => void;

  // Utilities
  getCurrentConversation: () => Conversation | null;
  getEffectiveSettings: (conversationId: string) => ModelSettings;
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversations: [],
  currentConversationId: null,
  globalSettings: DEFAULT_SETTINGS,
  uiPreferences: DEFAULT_UI_PREFERENCES,
  isGenerating: false,
  modelSources: [],
  folders: [],
  isLoading: true,

  setIsLoading: (isLoading) => set({ isLoading }),

  loadFromDatabase: async () => {
    try {
      set({ isLoading: true });

      // Load settings
      const settings = await dbApi.getSettings();

      // Load conversations (without messages for performance)
      const conversations = await dbApi.listConversations();

      // Load model sources
      const modelSources = await dbApi.listModelSources();

      // Load folders
      let folders = await dbApi.listFolders();

      // If no folders exist, create default "未分类" folder
      if (folders.length === 0) {
        const defaultFolder: Folder = {
          id: 'default-uncategorized',
          name: '未分类',
          color: '#6B7280',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await dbApi.createFolder(defaultFolder);
        folders = [defaultFolder];
      }

      set({
        conversations,
        currentConversationId: settings.currentConversationId,
        globalSettings: settings.globalSettings,
        uiPreferences: settings.uiPreferences,
        modelSources,
        folders,
        isLoading: false,
      });

      console.log('Loaded data from database:', {
        conversations: conversations.length,
        modelSources: modelSources.length,
        folders: folders.length,
      });
    } catch (error) {
      console.error('Failed to load from database:', error);
      set({ isLoading: false });
    }
  },

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

    // Sync to database
    dbApi.createConversation(newConversation).catch(console.error);
    dbApi.updateSettings({ currentConversationId: id }).catch(console.error);

    return id;
  },

  deleteConversation: (id) => {
    const state = get();
    const newConversations = state.conversations.filter((c) => c.id !== id);
    const newCurrentId = state.currentConversationId === id
      ? newConversations[0]?.id || null
      : state.currentConversationId;

    set({
      conversations: newConversations,
      currentConversationId: newCurrentId,
    });

    // Sync to database
    dbApi.deleteConversation(id).catch(console.error);
    if (newCurrentId !== state.currentConversationId) {
      dbApi.updateSettings({ currentConversationId: newCurrentId }).catch(console.error);
    }
  },

  renameConversation: (id, title) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: Date.now() } : c
      ),
    }));

    // Sync to database
    dbApi.updateConversation(id, { title, updatedAt: Date.now() }).catch(console.error);
  },

  selectConversation: (id) => {
    set({ currentConversationId: id });

    // Load full conversation with messages if not already loaded
    const conversation = get().conversations.find(c => c.id === id);
    if (conversation && (!conversation.messages || conversation.messages.length === 0)) {
      dbApi.getConversation(id).then(fullConv => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? fullConv : c
          ),
        }));
      }).catch(console.error);
    }

    // Sync to database
    dbApi.updateSettings({ currentConversationId: id }).catch(console.error);
  },

  pinConversation: (id) => {
    const conv = get().conversations.find(c => c.id === id);
    const isPinned = !conv?.isPinned;

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, isPinned } : c
      ),
    }));

    // Sync to database
    dbApi.updateConversation(id, { isPinned, updatedAt: Date.now() }).catch(console.error);
  },

  archiveConversation: (id) => {
    const conv = get().conversations.find(c => c.id === id);
    const isArchived = !conv?.isArchived;

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, isArchived } : c
      ),
    }));

    // Sync to database
    dbApi.updateConversation(id, { isArchived, updatedAt: Date.now() }).catch(console.error);
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

    // Sync to database
    dbApi.createConversation(forkedConversation).catch(console.error);
    dbApi.updateSettings({ currentConversationId: newId }).catch(console.error);
  },

  addMessage: (conversationId, message) => {
    const newMessage: Message = {
      ...message,
      id: nanoid(),
      createdAt: Date.now(),
    };

    // Get the old title before updating
    const oldConv = get().conversations.find(c => c.id === conversationId);
    const oldTitle = oldConv?.title;

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
            ...c,
            messages: [...(c.messages || []), newMessage],
            updatedAt: Date.now(),
            // Auto-generate title from first user message
            title:
              (c.messages?.length || 0) === 0 && message.role === 'user'
                ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
                : c.title,
          }
          : c
      ),
    }));

    // Sync to database
    dbApi.addMessage(conversationId, newMessage).catch(console.error);

    // Update conversation title if changed
    const newConv = get().conversations.find(c => c.id === conversationId);
    if (newConv && newConv.title !== oldTitle) {
      dbApi.updateConversation(conversationId, {
        title: newConv.title,
        updatedAt: Date.now()
      }).catch(console.error);
    }

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
            messages: (c.messages || []).map((m) =>
              m.id === messageId ? { ...m, ...messageUpdates } : m
            ),
            updatedAt: Date.now(),
          }
          : c
      ),
    }));

    // Sync to database
    dbApi.updateMessage(
      conversationId,
      messageId,
      messageUpdates.content,
      messageUpdates.reasoning_content
    ).catch(console.error);
  },

  deleteMessage: (conversationId, messageId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
            ...c,
            messages: (c.messages || []).filter((m) => m.id !== messageId),
            updatedAt: Date.now(),
          }
          : c
      ),
    }));

    // Sync to database
    dbApi.deleteMessage(conversationId, messageId).catch(console.error);
  },

  regenerateMessage: (conversationId, messageId) => {
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const messageIndex = (c.messages || []).findIndex((m) => m.id === messageId);
        if (messageIndex === -1) return c;
        return {
          ...c,
          messages: (c.messages || []).slice(0, messageIndex),
          updatedAt: Date.now(),
        };
      }),
    }));

    // Note: Messages are deleted from DB when deleteMessage is called
    // during the regeneration process
  },

  updateGlobalSettings: (settings) => {
    set((state) => ({
      globalSettings: { ...state.globalSettings, ...settings },
    }));

    // Sync to database
    const newSettings = { ...get().globalSettings, ...settings };
    dbApi.updateSettings({ globalSettings: newSettings }).catch(console.error);
  },

  updateConversationSettings: (conversationId, settings) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, settings: { ...c.settings, ...settings } }
          : c
      ),
    }));

    // Sync to database
    const conv = get().conversations.find(c => c.id === conversationId);
    if (conv) {
      dbApi.updateConversation(conversationId, {
        settings: conv.settings,
        updatedAt: Date.now()
      }).catch(console.error);
    }
  },

  updateUIPreferences: (preferences) => {
    set((state) => ({
      uiPreferences: { ...state.uiPreferences, ...preferences },
    }));

    // Sync to database
    const newPreferences = { ...get().uiPreferences, ...preferences };
    dbApi.updateSettings({ uiPreferences: newPreferences }).catch(console.error);
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
        dbApi.createConversation(data).catch(console.error);
        return;
      }

      // Handle bulk import
      if (data.conversations && Array.isArray(data.conversations)) {
        set((state) => ({
          conversations: [...data.conversations, ...state.conversations],
          globalSettings: data.globalSettings || state.globalSettings,
        }));

        // Import to database
        dbApi.importData({
          conversations: data.conversations,
          globalSettings: data.globalSettings || get().globalSettings,
          uiPreferences: get().uiPreferences,
          currentConversationId: get().currentConversationId,
          modelSources: get().modelSources,
        }).catch(console.error);
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

    // Sync to database
    dbApi.createModelSource(newSource).catch(console.error);

    return id;
  },

  updateModelSource: (id, source) => {
    set((state) => ({
      modelSources: state.modelSources.map((s) =>
        s.id === id ? { ...s, ...source, updatedAt: Date.now() } : s
      ),
    }));

    // Sync to database
    dbApi.updateModelSource(id, { ...source, updatedAt: Date.now() }).catch(console.error);
  },

  deleteModelSource: (id) => {
    set((state) => ({
      modelSources: state.modelSources.filter((s) => s.id !== id),
    }));

    // Sync to database
    dbApi.deleteModelSource(id).catch(console.error);
  },

  getModelSource: (id) => {
    return get().modelSources.find((s) => s.id === id);
  },

  // ==================== Folder Methods ====================

  createFolder: (name, color) => {
    const id = nanoid();
    const newFolder: Folder = {
      id,
      name,
      color: color || '#6B7280',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((state) => ({
      folders: [...state.folders, newFolder],
    }));

    // Sync to database
    dbApi.createFolder(newFolder).catch(console.error);

    return id;
  },

  updateFolder: (id, updates) => {
    set((state) => ({
      folders: state.folders.map((f) =>
        f.id === id ? { ...f, ...updates, updatedAt: Date.now() } : f
      ),
    }));

    // Sync to database
    dbApi.updateFolder(id, { ...updates, updatedAt: Date.now() }).catch(console.error);
  },

  deleteFolder: (id) => {
    // Prevent deleting default folder
    if (id === 'default-uncategorized') {
      console.error('Cannot delete default folder');
      return;
    }

    // Move all conversations in this folder to "uncategorized"
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
      conversations: state.conversations.map((c) =>
        c.folderId === id ? { ...c, folderId: 'default-uncategorized', updatedAt: Date.now() } : c
      ),
    }));

    // Sync to database
    dbApi.deleteFolder(id).catch(console.error);
  },

  moveConversationToFolder: (conversationId, folderId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, folderId, updatedAt: Date.now() }
          : c
      ),
    }));

    // Sync to database
    dbApi.updateConversation(conversationId, {
      folderId,
      updatedAt: Date.now(),
    }).catch(console.error);
  },

  copyConversation: async (id) => {
    try {
      const newConversation = await dbApi.copyConversation(id);

      set((state) => ({
        conversations: [newConversation, ...state.conversations],
        currentConversationId: newConversation.id,
      }));

      // Update current conversation ID in settings
      dbApi.updateSettings({ currentConversationId: newConversation.id }).catch(console.error);

      return newConversation.id;
    } catch (error) {
      console.error('Failed to copy conversation:', error);
      throw error;
    }
  },
}));
