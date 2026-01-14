// Core Types for ChatBox Application

export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  reasoning_content?: string; // 推理过程（DeepSeek Reasoner 等模型）
  createdAt: number;
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  text_content?: string;      // 提取的文本内容
  metadata?: Record<string, any>;  // 文件元数据
  parse_error?: string;       // 解析错误信息
  truncated?: boolean;        // 是否被截断
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

export type ExtraParamType = 'text' | 'json' | 'bool' | 'number';

export interface ExtraParam {
  name: string; // 参数名，如 extra_body
  value: string; // 参数值（统一用字符串存储）
  type: ExtraParamType; // 参数类型
  enabled: boolean; // 是否启用
}

export interface ModelSettings {
  model: string;
  temperature: number;
  top_p: number;
  max_tokens?: number;
  system?: string;
  extraParams?: ExtraParam[]; // 额外参数列表
}

export interface Folder {
  id: string;
  name: string;
  color?: string;
  isPinned?: boolean;
  createdAt: number;
  updatedAt: number;
  isExpanded?: boolean; // UI state, not persisted to database
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  settings?: Partial<ModelSettings>;
  isPinned?: boolean;
  isArchived?: boolean;
  folderId?: string; // Folder this conversation belongs to
}

export interface UIPreferences {
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  messageDensity: 'compact' | 'comfortable' | 'spacious';
  sidebarWidth: number;
  sidebarCollapsed?: boolean;  // 侧边栏是否收起
}

export interface AppState {
  conversations: Conversation[];
  currentConversationId: string | null;
  globalSettings: ModelSettings;
  uiPreferences: UIPreferences;
  isGenerating: boolean;
  modelSources: ModelSource[];
  folders: Folder[]; // Conversation folders
}

export interface ChatStreamEvent {
  delta?: string;
  reasoning_delta?: string; // 推理过程的增量内容
  done?: boolean;
  error?: string;
  finish_reason?: string;
}

export interface Model {
  id: string;
  name?: string;
  object: string;
  sourceId?: string; // 关联到哪个模型来源
}

export type ModelType = 'llm' | 'embedding' | 'reranker' | 'multimodal';

export interface ModelSource {
  id: string;
  name: string; // 模型提供商
  baseUrl: string; // OPENAI_BASE_URL
  apiKey: string; // OPENAI_API_KEY
  models: DetectedModel[]; // 检测到的模型列表
  createdAt: number;
  updatedAt: number;
}

export interface DetectedModel {
  id: string; // 模型名称
  name?: string; // 显示名称
  type: ModelType; // 模型类型
  isReasoning: boolean; // 是否是推理模型
  available: boolean; // 是否可用
}
