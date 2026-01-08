import React, { useState } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  Pin,
  Archive,
  Trash2,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { Conversation } from '@/types';
import { formatTimestamp, truncateText } from '@/utils/format';

interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  onPinConversation: (id: string) => void;
  onArchiveConversation: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  currentConversationId,
  onNewConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onPinConversation,
  onArchiveConversation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const startEditing = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditingTitle(conversation.title);
  };

  const saveEditing = () => {
    if (editingId && editingTitle.trim()) {
      onRenameConversation(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const filteredConversations = conversations.filter((conv) => {
    if (conv.isArchived) return false;
    if (!searchQuery) return true;
    return (
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.messages.some((m) =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  });

  // Sort: pinned first, then by updatedAt
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  return (
    <div className="w-72 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-base font-medium"
        >
          <Plus className="w-5 h-5" />
          <span>新建对话</span>
        </button>
      </div>

      {/* Search - Fixed */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索对话..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
          />
        </div>
      </div>

      {/* Conversation List - Scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sortedConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-base">
            {searchQuery ? '未找到对话' : '暂无对话'}
          </div>
        ) : (
          <div className="p-2">
            {sortedConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={clsx(
                  'group relative p-3 rounded-lg cursor-pointer mb-1 transition-colors',
                  conversation.id === currentConversationId
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-800'
                )}
                onClick={() => onSelectConversation(conversation.id)}
              >
                {editingId === conversation.id ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditing();
                        if (e.key === 'Escape') cancelEditing();
                      }}
                      className="flex-1 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
                      autoFocus
                    />
                    <button
                      onClick={saveEditing}
                      className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                    >
                      <Check className="w-4 h-4 text-green-600" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    >
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-base truncate">
                            {conversation.title}
                          </h3>
                          {conversation.isPinned && (
                            <Pin className="w-3 h-3 text-blue-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {conversation.messages[conversation.messages.length - 1]
                            ? truncateText(
                                conversation.messages[conversation.messages.length - 1].content,
                                50
                              )
                            : '暂无消息'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTimestamp(conversation.updatedAt)}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPinConversation(conversation.id);
                        }}
                        className={clsx(
                          'p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-700',
                          conversation.isPinned && 'text-blue-500'
                        )}
                        title={conversation.isPinned ? '取消置顶' : '置顶'}
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(conversation);
                        }}
                        className="p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
                        title="重命名"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('确定要删除这个对话吗？')) {
                            onDeleteConversation(conversation.id);
                          }
                        }}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"
                        title="删除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
