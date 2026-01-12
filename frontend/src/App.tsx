import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ModelSourcesPanel } from './components/ModelSourcesPanel';
import { useChatStore } from './store';
import { chatAPI } from './services/api';
import { downloadJSON, readJSONFile } from './utils/storage';
import { migrateFromLocalStorage } from './services/dbApi';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModelSourcesOpen, setIsModelSourcesOpen] = useState(false);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  const {
    conversations,
    currentConversationId,
    globalSettings,
    uiPreferences,
    isGenerating,
    isLoading,
    modelSources,
    folders,
    loadFromDatabase,
    createConversation,
    deleteConversation,
    renameConversation,
    selectConversation,
    pinConversation,
    archiveConversation,
    copyConversation,
    moveConversationToFolder,
    addMessage,
    updateMessage,
    deleteMessage,
    regenerateMessage,
    updateGlobalSettings,
    updateUIPreferences,
    setIsGenerating,
    addModelSource,
    updateModelSource,
    exportConversation,
    exportAllConversations,
    importConversations,
    getCurrentConversation,
    getEffectiveSettings,
    createFolder,
    deleteFolder,
    updateFolder,
  } = useChatStore();

  // Initialize database and migrate from localStorage on first load
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Try to migrate from localStorage first
        await migrateFromLocalStorage();

        // Load data from database
        await loadFromDatabase();

        // After loading from database, check if we need to initialize defaults
        const state = useChatStore.getState();

        // Initialize default model source ONLY if database has no model sources
        if (state.modelSources.length === 0) {
          await initializeDefaultSource();
        }

        // Create initial conversation ONLY if database has no conversations
        if (state.conversations.length === 0) {
          createConversation();
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    const initializeDefaultSource = async () => {
      try {
        // Check if .env has default source configured
        const apiBase = import.meta.env.DEV ? '/api' : '';
        const response = await fetch(`${apiBase}/v1/default-source`);
        if (!response.ok) {
          console.log('No default source configured');
          return;
        }

        const defaultSource = await response.json();
        if (!defaultSource.configured) {
          console.log('Default source not configured in .env');
          return;
        }

        console.log('Found default source configuration, detecting models...');

        // Try to fetch models from the default source
        try {
          const modelsResponse = await fetch(`${apiBase}/v1/models`);
          if (modelsResponse.ok) {
            const modelsData = await modelsResponse.json();
            if (modelsData.data && modelsData.data.length > 0) {
              // Add the default source
              const sourceId = addModelSource({
                name: defaultSource.name,
                baseUrl: defaultSource.baseUrl,
                apiKey: defaultSource.apiKey,
              });

              // Update with detected models
              const detectedModels = modelsData.data.map((model: any) => ({
                id: model.id,
                name: model.id,
                type: 'llm' as const,
                isReasoning: false,
                available: true,
              }));

              updateModelSource(sourceId, { models: detectedModels });

              // Auto-select first model
              if (detectedModels.length > 0) {
                updateGlobalSettings({ model: detectedModels[0].id });
                console.log(`Auto-selected model: ${detectedModels[0].id}`);
              }

              console.log(`Added default source with ${detectedModels.length} models`);
            }
          }
        } catch (error) {
          console.warn('Failed to fetch models from default source:', error);
        }
      } catch (error) {
        console.warn('Failed to initialize default source:', error);
      }
    };

    initializeApp();
  }, []); // Run once on mount

  // Apply theme on mount and when it changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', uiPreferences.theme === 'dark');
  }, [uiPreferences.theme]);

  const handleSendMessage = async (content: string, skipAddingUserMessage = false) => {
    if (!currentConversationId) {
      const newId = createConversation();
      selectConversation(newId);
      // Wait a bit for the state to update
      setTimeout(() => handleSendMessage(content, skipAddingUserMessage), 100);
      return;
    }

    // Add user message (skip if regenerating or editing)
    if (!skipAddingUserMessage) {
      addMessage(currentConversationId, {
        role: 'user',
        content,
      });
    }

    // Create assistant message placeholder
    const assistantMessage = addMessage(currentConversationId, {
      role: 'assistant',
      content: '',
    });
    setCurrentMessageId(assistantMessage.id);

    // Start streaming
    setIsGenerating(true);
    try {
      const conversation = getCurrentConversation();
      if (!conversation) return;

      const settings = getEffectiveSettings(currentConversationId);

      // 过滤掉刚创建的空 assistant 占位消息（它的 id 是 assistantMessage.id）
      const messages = conversation.messages.filter(
        msg => msg.id !== assistantMessage.id
      );

      // Add the user message we just created (only if not skipping)
      if (!skipAddingUserMessage) {
        const fullContent = content;
        messages.push({
          id: 'temp',
          role: 'user',
          content: fullContent,
          createdAt: Date.now(),
        });
      }

      // 查找当前模型对应的模型源，并判断是否为推理模型
      let apiConfig: { baseUrl?: string; apiKey?: string } | undefined;
      let isReasoningModel = false;

      for (const source of modelSources) {
        const model = source.models.find(m => m.id === settings.model && m.available);
        if (model) {
          apiConfig = {
            baseUrl: source.baseUrl,
            apiKey: source.apiKey,
          };
          isReasoningModel = model.isReasoning;
          console.log(`Model ${settings.model} is reasoning model:`, isReasoningModel);
          break;
        }
      }

      let fullContent = ''; // 完整累积的内容
      let hasApiReasoningContent = false; // 是否从 API 获得了 reasoning_content
      let hasFoundCloseTag = false; // 是否已经找到 </think> 标签

      for await (const event of chatAPI.streamChatCompletion(messages, settings, apiConfig)) {
        if (event.error) {
          updateMessage(currentConversationId, assistantMessage.id, `Error: ${event.error}`);
          break;
        }

        // 情况1: API 直接返回 reasoning_content（如 DeepSeek Reasoner）
        if (event.reasoning_delta) {
          hasApiReasoningContent = true;
          // 这种情况下，reasoning_content 和 content 是分开的
          const currentMsg = getCurrentConversation()?.messages.find(m => m.id === assistantMessage.id);
          const currentReasoning = currentMsg?.reasoning_content || '';
          const currentContent = currentMsg?.content || '';

          updateMessage(currentConversationId, assistantMessage.id, {
            content: currentContent + (event.delta || ''),
            reasoning_content: currentReasoning + event.reasoning_delta,
          });
          continue;
        }

        // 情况2-4: 只有普通 content delta
        if (event.delta) {
          fullContent += event.delta;

          // 如果是推理模型，且没有从 API 获得 reasoning_content
          if (isReasoningModel && !hasApiReasoningContent) {
            if (!hasFoundCloseTag) {
              // 还没找到标签，继续查找
              // 使用正则表达式匹配 </think> 标签
              const closeTagRegex = /<\/think>/i;
              const match = fullContent.match(closeTagRegex);

              if (match && match.index !== undefined) {
                // 找到了 </think> 标签
                hasFoundCloseTag = true;
                const reasoning = fullContent.substring(0, match.index).trim();
                const content = fullContent.substring(match.index + match[0].length).trim();

                console.log('✓ Found </think> tag!');
                console.log('  Tag position:', match.index);
                console.log('  Reasoning length:', reasoning.length);
                console.log('  Content after tag:', content.substring(0, 50));

                updateMessage(currentConversationId, assistantMessage.id, {
                  content: content,
                  reasoning_content: reasoning,
                });
              } else {
                // 还没找到 </think> 标签，暂时全部放入 reasoning_content
                updateMessage(currentConversationId, assistantMessage.id, {
                  content: '',
                  reasoning_content: fullContent,
                });
              }
            } else {
              // 已经找到标签了，后续内容直接追加到 content
              const closeTagRegex = /<\/think>/i;
              const match = fullContent.match(closeTagRegex);

              if (match && match.index !== undefined) {
                const reasoning = fullContent.substring(0, match.index).trim();
                const content = fullContent.substring(match.index + match[0].length).trim();

                updateMessage(currentConversationId, assistantMessage.id, {
                  content: content,
                  reasoning_content: reasoning,
                });
              }
            }
          } else {
            // 不是推理模型，或已经有 API reasoning_content，正常显示
            updateMessage(currentConversationId, assistantMessage.id, fullContent);
          }
        }

        if (event.done) {
          // 流式结束后的最终处理
          console.log('=== Stream Done ===');
          console.log('isReasoningModel:', isReasoningModel);
          console.log('hasApiReasoningContent:', hasApiReasoningContent);
          console.log('hasFoundCloseTag:', hasFoundCloseTag);
          console.log('fullContent length:', fullContent.length);

          if (isReasoningModel && !hasApiReasoningContent) {
            // 检查是否包含 </think> 标签（各种可能的形式）
            const searchPatterns = [
              '</think>',
              '\\n</think>',
              '</think>\\n',
              '\\n</think>\\n',
            ];

            console.log('Searching for </think> tag...');
            for (const pattern of searchPatterns) {
              const idx = fullContent.indexOf(pattern);
              if (idx !== -1) {
                console.log(`  Found pattern "${pattern}" at index ${idx}`);
                console.log(`  Context: ...${fullContent.substring(Math.max(0, idx - 20), idx + 30)}...`);
              }
            }

            const closeTagRegex = /<\/think>/i;
            const match = fullContent.match(closeTagRegex);

            console.log('Regex match result:', match ? `Found at ${match.index}` : 'Not found');

            if (!match) {
              // 最终没有找到 </think> 标签，将所有内容移到 content
              console.log('⚠ No </think> tag found, moving all content to display area');
              updateMessage(currentConversationId, assistantMessage.id, {
                content: fullContent,
                reasoning_content: undefined,
              });
            } else {
              console.log('✓ Stream finished with </think> tag already processed');
            }
          }
          console.log('==================');
          break;
        }
      }
    } catch (error: any) {
      updateMessage(
        currentConversationId,
        assistantMessage.id,
        `Error: ${error.message || 'Unknown error occurred'}`
      );
    } finally {
      setIsGenerating(false);
      setCurrentMessageId(null);
    }
  };

  const handleStopGeneration = () => {
    chatAPI.stopGeneration();
    setIsGenerating(false);
  };

  const handleRegenerateMessage = (messageId: string) => {
    if (!currentConversationId) return;

    const conversation = getCurrentConversation();
    if (!conversation) return;

    // Find the message and remove it and all after it
    const messageIndex = conversation.messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    // Remove the assistant message
    deleteMessage(currentConversationId, messageId);

    // Find the last user message before this
    const userMessages = conversation.messages
      .slice(0, messageIndex)
      .filter((m) => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];

    if (lastUserMessage) {
      // Resend the last user message (skip adding it again since it already exists)
      handleSendMessage(lastUserMessage.content, true);
    }
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    if (!currentConversationId) return;

    const conversation = getCurrentConversation();
    if (!conversation) return;

    // Find the message index
    const messageIndex = conversation.messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    // Update the message content
    updateMessage(currentConversationId, messageId, newContent);

    // Delete all messages after this one
    const messagesToDelete = conversation.messages.slice(messageIndex + 1);
    messagesToDelete.forEach((msg) => {
      deleteMessage(currentConversationId, msg.id);
    });

    // Resend the edited message (skip adding it again since we just updated it)
    setTimeout(() => {
      handleSendMessage(newContent, true);
    }, 100);
  };

  const handleExportConversation = () => {
    if (!currentConversationId) return;
    try {
      const json = exportConversation(currentConversationId);
      const conversation = getCurrentConversation();
      downloadJSON(
        JSON.parse(json),
        `chatbox-${conversation?.title || 'conversation'}-${Date.now()}.json`
      );
    } catch (error) {
      alert('导出对话失败');
    }
  };

  const handleExportAll = () => {
    try {
      const json = exportAllConversations();
      downloadJSON(JSON.parse(json), `chatbox-export-${Date.now()}.json`);
    } catch (error) {
      alert('导出对话失败');
    }
  };

  const handleImport = async (file: File) => {
    try {
      const data = await readJSONFile(file);
      importConversations(JSON.stringify(data));
      alert('导入成功！');
      setIsSettingsOpen(false);
    } catch (error: any) {
      alert(`导入失败：${error.message}`);
    }
  };

  const handleRenameFolder = (folderId: string, name: string) => {
    updateFolder(folderId, { name });
  };

  const handlePinFolder = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (folder) {
      updateFolder(folderId, { isPinned: !folder.isPinned });
    }
  };

  const currentConversation = getCurrentConversation();

  // Show loading screen while initializing
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading YUI ChatBox...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        folders={folders}
        currentConversationId={currentConversationId}
        collapsed={uiPreferences.sidebarCollapsed}
        onToggleCollapsed={() => updateUIPreferences({ sidebarCollapsed: !uiPreferences.sidebarCollapsed })}
        onNewConversation={createConversation}
        onSelectConversation={selectConversation}
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
        onPinConversation={pinConversation}
        onCopyConversation={copyConversation}
        onMoveConversation={moveConversationToFolder}
        onCreateFolder={createFolder}
        onDeleteFolder={deleteFolder}
        onRenameFolder={handleRenameFolder}
        onPinFolder={handlePinFolder}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Chat Panel */}
        <ChatPanel
          conversation={currentConversation}
          isGenerating={isGenerating}
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
          onRegenerateMessage={handleRegenerateMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={(messageId) => {
            if (currentConversationId) {
              deleteMessage(currentConversationId, messageId);
            }
          }}
          onExportConversation={handleExportConversation}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={globalSettings}
        uiPreferences={uiPreferences}
        onUpdateSettings={updateGlobalSettings}
        onUpdateUIPreferences={updateUIPreferences}
        onExport={handleExportAll}
        onImport={handleImport}
        onOpenModelSources={() => {
          setIsSettingsOpen(false);
          setIsModelSourcesOpen(true);
        }}
      />

      {/* Model Sources Panel */}
      <ModelSourcesPanel
        isOpen={isModelSourcesOpen}
        onClose={() => setIsModelSourcesOpen(false)}
      />
    </div>
  );
}

export default App;
