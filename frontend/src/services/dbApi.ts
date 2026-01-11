/**
 * Database API Service
 * Handles all communication with SQLite database through backend API
 */
import type { Conversation, Message, ModelSource, ModelSettings, UIPreferences, Folder } from '@/types';

const API_BASE = import.meta.env.DEV ? '/api/db' : '/api/db';

// ==================== Settings ====================

export interface AppSettings {
  currentConversationId: string | null;
  globalSettings: ModelSettings;
  uiPreferences: UIPreferences;
}

export async function getSettings(): Promise<AppSettings> {
  const response = await fetch(`${API_BASE}/settings`);
  if (!response.ok) {
    throw new Error('Failed to fetch settings');
  }
  return response.json();
}

export async function updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const response = await fetch(`${API_BASE}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error('Failed to update settings');
  }
  return response.json();
}

// ==================== Conversations ====================

export async function listConversations(): Promise<Conversation[]> {
  const response = await fetch(`${API_BASE}/conversations`);
  if (!response.ok) {
    throw new Error('Failed to fetch conversations');
  }
  return response.json();
}

export async function getConversation(id: string): Promise<Conversation> {
  const response = await fetch(`${API_BASE}/conversations/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch conversation');
  }
  return response.json();
}

export async function createConversation(conversation: Conversation): Promise<Conversation> {
  const response = await fetch(`${API_BASE}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(conversation),
  });
  if (!response.ok) {
    throw new Error('Failed to create conversation');
  }
  return response.json();
}

export async function updateConversation(
  id: string,
  updates: Partial<Pick<Conversation, 'title' | 'updatedAt' | 'settings' | 'isPinned' | 'isArchived' | 'folderId'>>
): Promise<Conversation> {
  const response = await fetch(`${API_BASE}/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error('Failed to update conversation');
  }
  return response.json();
}

export async function deleteConversation(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/conversations/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete conversation');
  }
}

// Copy conversation with all messages
export async function copyConversation(id: string): Promise<Conversation> {
  const response = await fetch(`${API_BASE}/conversations/${id}/copy`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to copy conversation');
  }
  return response.json();
}

// ==================== Messages ====================

export async function addMessage(conversationId: string, message: Message): Promise<Message> {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!response.ok) {
    throw new Error('Failed to add message');
  }
  return response.json();
}

export async function updateMessage(
  conversationId: string,
  messageId: string,
  content?: string,
  reasoning_content?: string
): Promise<Message> {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, reasoning_content }),
  });
  if (!response.ok) {
    throw new Error('Failed to update message');
  }
  return response.json();
}

export async function deleteMessage(conversationId: string, messageId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete message');
  }
}

// ==================== Model Sources ====================

export async function listModelSources(): Promise<ModelSource[]> {
  const response = await fetch(`${API_BASE}/model-sources`);
  if (!response.ok) {
    throw new Error('Failed to fetch model sources');
  }
  return response.json();
}

export async function createModelSource(source: ModelSource): Promise<ModelSource> {
  const response = await fetch(`${API_BASE}/model-sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(source),
  });
  if (!response.ok) {
    throw new Error('Failed to create model source');
  }
  return response.json();
}

export async function updateModelSource(
  id: string,
  updates: Partial<ModelSource>
): Promise<ModelSource> {
  const response = await fetch(`${API_BASE}/model-sources/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error('Failed to update model source');
  }
  return response.json();
}

export async function deleteModelSource(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/model-sources/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete model source');
  }
}

// ==================== Data Import/Export ====================

export interface ImportData {
  conversations: Conversation[];
  globalSettings: ModelSettings;
  uiPreferences: UIPreferences;
  currentConversationId: string | null;
  modelSources: ModelSource[];
}

export async function importData(data: ImportData): Promise<{ ok: boolean; imported: any }> {
  const response = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to import data');
  }
  return response.json();
}

export async function exportAllData(): Promise<any> {
  const response = await fetch(`${API_BASE}/export`);
  if (!response.ok) {
    throw new Error('Failed to export data');
  }
  return response.json();
}

// ==================== Folders ====================

export async function listFolders(): Promise<Folder[]> {
  const response = await fetch(`${API_BASE}/folders`);
  if (!response.ok) {
    throw new Error('Failed to fetch folders');
  }
  return response.json();
}

export async function createFolder(folder: Folder): Promise<Folder> {
  const response = await fetch(`${API_BASE}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(folder),
  });
  if (!response.ok) {
    throw new Error('Failed to create folder');
  }
  return response.json();
}

export async function updateFolder(
  id: string,
  updates: Partial<Pick<Folder, 'name' | 'color' | 'updatedAt'>>
): Promise<Folder> {
  const response = await fetch(`${API_BASE}/folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error('Failed to update folder');
  }
  return response.json();
}

export async function deleteFolder(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/folders/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete folder');
  }
}

// ==================== Migration Helper ====================

/**
 * Migrate data from localStorage to database
 * This should be called once on first load after upgrade
 */
export async function migrateFromLocalStorage(): Promise<boolean> {
  try {
    // Check if already migrated
    const migrated = localStorage.getItem('db-migrated');
    if (migrated === 'true') {
      return false; // Already migrated
    }

    // Get data from localStorage
    const storedData = localStorage.getItem('chatbox-storage');
    if (!storedData) {
      // No data to migrate
      localStorage.setItem('db-migrated', 'true');
      return false;
    }

    const data = JSON.parse(storedData);
    const state = data.state || data;

    // Prepare import data
    const dataToImport: ImportData = {
      conversations: state.conversations || [],
      globalSettings: state.globalSettings || {
        model: '',
        temperature: 0.7,
        top_p: 1.0,
        max_tokens: undefined,
        system: undefined,
      },
      uiPreferences: state.uiPreferences || {
        theme: 'light',
        fontSize: 'medium',
        messageDensity: 'comfortable',
        sidebarWidth: 280,
      },
      currentConversationId: state.currentConversationId || null,
      modelSources: state.modelSources || [],
    };

    // Import to database
    await importData(dataToImport);

    // Mark as migrated
    localStorage.setItem('db-migrated', 'true');

    console.log('Successfully migrated data from localStorage to database');
    return true;
  } catch (error) {
    console.error('Failed to migrate data from localStorage:', error);
    return false;
  }
}
