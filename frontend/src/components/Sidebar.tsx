import React, { useState } from 'react';
import { Search, Copy, Folder as FolderIcon, Trash2, Edit2, FolderPlus, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { Conversation, Folder } from '@/types';
import { FolderTree } from './FolderTree';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

interface SidebarProps {
  conversations: Conversation[];
  folders: Folder[];
  currentConversationId: string | null;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  onPinConversation: (id: string) => void;
  onCopyConversation: (id: string) => void;
  onMoveConversation: (conversationId: string, folderId: string) => void;
  onCreateFolder: (name: string, color?: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onPinFolder: (folderId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  folders,
  currentConversationId,
  collapsed = false,
  onToggleCollapsed,
  onNewConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onPinConversation,
  onCopyConversation,
  onMoveConversation,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onPinFolder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    conversationId: string;
  } | null>(null);
  const [folderSelectDialog, setFolderSelectDialog] = useState<{
    conversationId: string;
    folders: Folder[];
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      conversationId,
    });
  };

  const handleCreateFolder = () => {
    const name = prompt('输入文件夹名称:');
    if (name && name.trim()) {
      onCreateFolder(name.trim());
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    if (conv.isArchived) return false;
    if (!searchQuery) return true;
    return (
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.messages || []).some((m) =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  });

  const contextMenuItems: ContextMenuItem[] = contextMenu
    ? [
      {
        icon: <Copy className="w-4 h-4" />,
        label: '复制对话',
        onClick: () => {
          onCopyConversation(contextMenu.conversationId);
        },
      },
      {
        icon: <FolderIcon className="w-4 h-4" />,
        label: '移动到...',
        onClick: () => {
          const availableFolders = folders.filter(
            (f) => f.id !== conversations.find((c) => c.id === contextMenu.conversationId)?.folderId
          );

          if (availableFolders.length === 0) {
            alert('没有其他文件夹可移动');
            setContextMenu(null);
            return;
          }

          setFolderSelectDialog({
            conversationId: contextMenu.conversationId,
            folders: availableFolders,
          });
          setContextMenu(null);
        },
      },
      {
        icon: <Edit2 className="w-4 h-4" />,
        label: '重命名',
        onClick: () => {
          // 关闭菜单，触发内联编辑
          const conversationId = contextMenu.conversationId;
          setContextMenu(null);

          // 触发对话项的内联编辑
          // 通过点击编辑按钮来触发（因为已有内联编辑逻辑）
          setTimeout(() => {
            const convElement = document.querySelector(`[data-conversation-id="${conversationId}"]`);
            const editButton = convElement?.querySelector('[title="重命名"]') as HTMLButtonElement;
            if (editButton) {
              editButton.click();
            }
          }, 50);
        },
      },
      {
        icon: <Trash2 className="w-4 h-4" />,
        label: '删除',
        onClick: () => {
          onDeleteConversation(contextMenu.conversationId);
        },
        danger: true,
      },
    ]
    : [];

  return (
    <div className={`bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-72'
      }`}>
      {/* Header with Toggle Button */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center">
        <button
          onClick={onToggleCollapsed}
          className={`flex rounded-xl justify-center items-center hover:bg-gray-100/50 dark:hover:bg-gray-850/50 transition ${collapsed ? 'w-8 h-8 mx-auto' : 'w-8 h-8'
            }`}
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          <div className="self-center p-1.5">
            {collapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                <rect x="3" y="3" width="18" height="18" rx="5" ry="5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none"></rect>
                <path d="M14.5 21V3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                <rect x="3" y="3" width="18" height="18" rx="5" ry="5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none"></rect>
                <path d="M9.5 21V3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            )}
          </div>
        </button>
      </div>

      {/* New Conversation Button */}
      {collapsed ? (
        <div className="flex-shrink-0 p-2 border-b border-gray-200 dark:border-gray-700 flex justify-center">
          <button
            onClick={() => {
              if (onToggleCollapsed) onToggleCollapsed();
              setTimeout(() => onNewConversation(), 100);
            }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="新建对话"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"></path>
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={onNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-base font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"></path>
            </svg>
            <span>新建对话</span>
          </button>
        </div>
      )}

      {/* Search - Fixed */}
      {!collapsed && (
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
      )}

      {/* New Folder Button */}
      {!collapsed && (
        <div className="flex-shrink-0 px-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCreateFolder}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors text-sm font-medium"
          >
            <FolderPlus className="w-4 h-4" />
            <span>新建文件夹</span>
          </button>
        </div>
      )}

      {/* Folder Tree - Scrollable */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto min-h-0 p-2">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-base">
              {searchQuery ? '未找到对话' : '暂无对话'}
            </div>
          ) : (
            <FolderTree
              folders={folders}
              conversations={filteredConversations}
              currentConversationId={currentConversationId}
              onSelectConversation={onSelectConversation}
              onRenameConversation={onRenameConversation}
              onDeleteConversation={onDeleteConversation}
              onPinConversation={onPinConversation}
              onMoveConversation={onMoveConversation}
              onContextMenu={handleContextMenu}
              onDeleteFolder={onDeleteFolder}
              onRenameFolder={onRenameFolder}
              onPinFolder={onPinFolder}
            />
          )}
        </div>
      )}

      {/* Folder Selection Dialog */}
      {folderSelectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setFolderSelectDialog(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">选择目标文件夹</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {folderSelectDialog.folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => {
                    onMoveConversation(folderSelectDialog.conversationId, folder.id);
                    setFolderSelectDialog(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-left"
                >
                  <FolderIcon className="w-5 h-5" style={{ color: folder.color || '#6B7280' }} />
                  <span className="font-medium text-gray-900 dark:text-gray-100">{folder.name}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setFolderSelectDialog(null)}
              className="mt-4 w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 rounded-lg transition-colors text-sm font-medium"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
