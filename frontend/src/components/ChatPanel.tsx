import React, { useRef, useEffect, useMemo } from 'react';
import { Download, Settings as SettingsIcon } from 'lucide-react';
import { Message } from './Message';
import { ChatInput } from './ChatInput';
import type { Conversation } from '@/types';
import { clsx } from 'clsx';
import { useChatStore } from '@/store';

interface ChatPanelProps {
  conversation: Conversation | null;
  isGenerating: boolean;
  onSendMessage: (content: string) => void;
  onStopGeneration: () => void;
  onRegenerateMessage: (messageId: string) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onExportConversation: () => void;
  onOpenSettings: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  conversation,
  isGenerating,
  onSendMessage,
  onStopGeneration,
  onRegenerateMessage,
  onEditMessage,
  onDeleteMessage,
  onExportConversation,
  onOpenSettings,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { modelSources, getEffectiveSettings } = useChatStore();

  // 判断当前模型是否为推理模型（用于 Message 组件显示，但实际分离逻辑在 App.tsx）
  const isReasoningModel = useMemo(() => {
    if (!conversation) return false;

    const settings = getEffectiveSettings(conversation.id);
    const currentModel = settings.model;

    // 在模型源中查找当前模型
    for (const source of modelSources) {
      const model = source.models.find(m => m.id === currentModel);
      if (model && model.isReasoning) {
        return true;
      }
    }

    return false;
  }, [conversation, modelSources, getEffectiveSettings]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [conversation?.messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">欢迎使用 ChatBox</h2>
          <p className="text-gray-500 text-lg">
            请从左侧选择一个对话或创建新对话开始聊天
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 min-h-0">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between bg-white dark:bg-gray-900">
        <div>
          <h1 className="text-xl font-semibold truncate">{conversation.title}</h1>
          <p className="text-base text-gray-500">
            {conversation.messages.length} 条消息
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onExportConversation}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="导出对话"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="设置"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto min-h-0"
      >
        {conversation.messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p className="text-lg">暂无消息，开始对话吧！</p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {conversation.messages.map((message) => (
              <Message
                key={message.id}
                message={message}
                isReasoningModel={isReasoningModel}
                onEditMessage={onEditMessage}
                onRegenerate={onRegenerateMessage}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSendMessage}
        onStop={onStopGeneration}
        isGenerating={isGenerating}
      />
    </div>
  );
};
