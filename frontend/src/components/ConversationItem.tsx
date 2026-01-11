import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MessageSquare, Pin, Trash2, Edit2, Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { Conversation } from '@/types';
import { formatTimestamp, truncateText } from '@/utils/format';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onPin,
  onContextMenu,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: conversation.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditingTitle(conversation.title);
  };

  const saveEditing = () => {
    if (editingTitle.trim()) {
      onRename(conversation.id, editingTitle.trim());
    }
    setIsEditing(false);
    setEditingTitle('');
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditingTitle('');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个对话吗？')) {
      onDelete(conversation.id);
    }
  };

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPin(conversation.id);
  };

  const lastMessage = conversation.messages?.[conversation.messages.length - 1];

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-conversation-id={conversation.id}
      {...attributes}
      {...listeners}
      className={clsx(
        'group relative p-3 rounded-lg cursor-pointer mb-1 transition-colors',
        isActive
          ? 'bg-blue-100 dark:bg-blue-900/30'
          : 'hover:bg-gray-200 dark:hover:bg-gray-800'
      )}
      onClick={() => !isEditing && onSelect(conversation.id)}
      onContextMenu={(e) => onContextMenu(e, conversation.id)}
    >
      {isEditing ? (
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
          <div className="flex items-start gap-2 mb-1">
            <MessageSquare className="w-4 h-4 flex-shrink-0 mt-1 text-gray-500" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium truncate">
                  {conversation.title}
                </h3>
                {conversation.isPinned && (
                  <Pin className="w-3 h-3 text-blue-500 flex-shrink-0" />
                )}
              </div>
              {lastMessage && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {truncateText(lastMessage.content, 50)}
                </p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {formatTimestamp(conversation.updatedAt)}
              </p>
            </div>
          </div>

          {/* Action buttons - visible on hover */}
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handlePin}
              className={clsx(
                'p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-700',
                conversation.isPinned && 'text-blue-500'
              )}
              title={conversation.isPinned ? '取消置顶' : '置顶'}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={startEditing}
              className="p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
              title="重命名"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
