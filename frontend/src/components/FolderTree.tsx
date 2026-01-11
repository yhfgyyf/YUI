import React, { useState, useMemo } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable } from '@dnd-kit/core';
import { Folder, ChevronDown, ChevronRight, Trash2, Edit2, Pin, Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { Folder as FolderType, Conversation } from '@/types';
import { ConversationItem } from './ConversationItem';

interface FolderTreeProps {
  folders: FolderType[];
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  onPinConversation: (id: string) => void;
  onMoveConversation: (conversationId: string, folderId: string) => void;
  onContextMenu: (e: React.MouseEvent, conversationId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onPinFolder: (folderId: string) => void;
}

// Folder Item Component with useDroppable
interface FolderItemProps {
  folder: FolderType;
  isExpanded: boolean;
  conversationCount: number;
  onToggle: (folderId: string) => void;
  onRename: (folderId: string, name: string) => void;
  onDelete: (folderId: string) => void;
  onPin: (folderId: string) => void;
  children: React.ReactNode;
}

const FolderItem: React.FC<FolderItemProps> = ({ folder, isExpanded, conversationCount, onToggle, onRename, onDelete, onPin, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: folder.id,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditingName(folder.name);
  };

  const saveEditing = () => {
    if (editingName.trim()) {
      onRename(folder.id, editingName.trim());
    }
    setIsEditing(false);
    setEditingName('');
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditingName('');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定要删除文件夹"${folder.name}"吗？其中的会话将移至"未分类"。`)) {
      onDelete(folder.id);
    }
  };

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPin(folder.id);
  };

  const isDefaultFolder = folder.id === 'default-uncategorized';

  return (
    <div className="mb-2">
      {/* Folder Header */}
      <div
        ref={setNodeRef}
        className={clsx(
          'group flex items-center gap-2 px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded cursor-pointer transition-colors',
          isOver && 'bg-blue-100 dark:bg-blue-900/30'
        )}
        onClick={() => !isEditing && onToggle(folder.id)}
        id={folder.id}
      >
        {isEditing ? (
          // Editing mode
          <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
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
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-500" />
            )}
            <Folder
              className="w-4 h-4 flex-shrink-0"
              style={{ color: folder.color || '#6B7280' }}
            />
            <span className="font-medium text-sm truncate flex-1">
              {folder.name}
            </span>
            {folder.isPinned && (
              <Pin className="w-3 h-3 text-blue-500 flex-shrink-0" />
            )}
            <span className="text-xs text-gray-500 ml-auto">
              {conversationCount}
            </span>

            {/* Action buttons - visible on hover (only for user folders) */}
            {!isDefaultFolder && (
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                <button
                  onClick={handlePin}
                  className={clsx(
                    'p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-700',
                    folder.isPinned && 'text-blue-500'
                  )}
                  title={folder.isPinned ? '取消置顶' : '置顶'}
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
                  title="删除文件夹"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {children}
    </div>
  );
};

export const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  conversations,
  currentConversationId,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onPinConversation,
  onMoveConversation,
  onContextMenu,
  onDeleteFolder,
  onRenameFolder,
  onPinFolder,
}) => {
  // Initialize with only default folder expanded
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    const defaultFoldersToExpand = folders
      .filter(f => f.id === 'default-uncategorized')
      .map(f => f.id);
    return new Set(defaultFoldersToExpand);
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start dragging
      },
    })
  );

  const handleDragStart = (event: any) => {
    setActiveConversationId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveConversationId(null);

    if (!over) return;

    const conversationId = active.id as string;
    const folderId = over.id as string;

    // Check if dropped on a folder
    if (folders.some((f) => f.id === folderId)) {
      onMoveConversation(conversationId, folderId);
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Group conversations by folder
  const conversationsByFolder = conversations.reduce((acc, conv) => {
    const folderId = conv.folderId || 'default-uncategorized';
    if (!acc[folderId]) acc[folderId] = [];
    acc[folderId].push(conv);
    return acc;
  }, {} as Record<string, Conversation[]>);

  // Sort conversations within each folder: pinned first, then by updatedAt
  const sortConversations = (convs: Conversation[]) => {
    return [...convs].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  // Sort folders: pinned -> unpinned (newest first) -> default uncategorized
  const sortedFolders = useMemo(() => {
    const pinnedFolders = folders.filter(f => f.isPinned && f.id !== 'default-uncategorized');
    const unpinnedFolders = folders.filter(f => !f.isPinned && f.id !== 'default-uncategorized');
    const defaultFolder = folders.find(f => f.id === 'default-uncategorized');

    // Sort each group by creation time (newest first)
    const sortByDate = (a: FolderType, b: FolderType) => b.createdAt - a.createdAt;

    return [
      ...pinnedFolders.sort(sortByDate),
      ...unpinnedFolders.sort(sortByDate),
      ...(defaultFolder ? [defaultFolder] : [])
    ];
  }, [folders]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-1">
        {sortedFolders.map((folder) => {
          const isExpanded = expandedFolders.has(folder.id);
          const folderConversations = sortConversations(
            conversationsByFolder[folder.id] || []
          );

          return (
            <FolderItem
              key={folder.id}
              folder={folder}
              isExpanded={isExpanded}
              conversationCount={folderConversations.length}
              onToggle={toggleFolder}
              onRename={onRenameFolder}
              onDelete={onDeleteFolder}
              onPin={onPinFolder}
            >
              {/* Conversation List */}
              {isExpanded && (
                <div className="ml-6 mt-1 space-y-1">
                  {folderConversations.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 text-center">
                      暂无对话
                    </div>
                  ) : (
                    folderConversations.map((conversation) => (
                      <ConversationItem
                        key={conversation.id}
                        conversation={conversation}
                        isActive={conversation.id === currentConversationId}
                        onSelect={onSelectConversation}
                        onRename={onRenameConversation}
                        onDelete={onDeleteConversation}
                        onPin={onPinConversation}
                        onContextMenu={onContextMenu}
                      />
                    ))
                  )}
                </div>
              )}
            </FolderItem>
          );
        })}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeConversation ? (
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-64">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium truncate">
                {activeConversation.title}
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
