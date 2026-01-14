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

  const handleSendMessage = async (content: string, attachments: import('@/types').Attachment[] = [], skipAddingUserMessage = false) => {
    if (!currentConversationId) {
      const newId = createConversation();
      selectConversation(newId);
      // Wait a bit for the state to update
      setTimeout(() => handleSendMessage(content, attachments, skipAddingUserMessage), 100);
      return;
    }

    // Add user message with attachments (skip if regenerating or editing)
    if (!skipAddingUserMessage) {
      addMessage(currentConversationId, {
        role: 'user',
        content,
        attachments,
      });
    }

    // Create assistant message placeholder (skip DB sync, will sync at the end)
    const assistantMessage = addMessage(currentConversationId, {
      role: 'assistant',
      content: '',
    }, true);  // skipDbSync = true
    setCurrentMessageId(assistantMessage.id);

    // Start streaming
    setIsGenerating(true);
    try {
      const conversation = getCurrentConversation();
      if (!conversation) return;

      const settings = getEffectiveSettings(currentConversationId);

      // 收集所有历史对话中上传的文件（累积模式）
      // 1. 从历史消息中收集所有附件
      const historicalAttachments: import('@/types').Attachment[] = [];
      const attachmentIds = new Set<string>();

      for (const msg of conversation.messages) {
        if (msg.role === 'user' && msg.attachments && msg.attachments.length > 0) {
          for (const att of msg.attachments) {
            // 去重：基于文件ID
            if (!attachmentIds.has(att.id)) {
              attachmentIds.add(att.id);
              historicalAttachments.push(att);
            }
          }
        }
      }

      // 2. 将当前上传的附件也加入（如果有）
      const currentAttachments = attachments || [];
      for (const att of currentAttachments) {
        if (!attachmentIds.has(att.id)) {
          attachmentIds.add(att.id);
          historicalAttachments.push(att);
        }
      }

      // 3. 使用累积的所有附件
      const effectiveAttachments = historicalAttachments;

      // 日志：显示收集到的文件信息
      if (effectiveAttachments.length > 0) {
        console.log('[File Context] Collected attachments:', effectiveAttachments.length);
        effectiveAttachments.forEach((att, idx) => {
          console.log(`  [${idx + 1}] ${att.name} (${att.id})`);
        });
      }

      // 构建文件上下文（如果有附件）
      let fileContext = '';
      if (effectiveAttachments && effectiveAttachments.length > 0) {
        const validFiles = effectiveAttachments.filter(att => att.text_content && !att.parse_error);
        if (validFiles.length > 0) {
          const fileContents = validFiles.map(att => {
            let context = `<file name="${att.name}" type="${att.type}">`;
            if (att.truncated) {
              context += `\n[Note: Content truncated to ${att.text_content?.length} characters]`;
            }
            context += `\n${att.text_content}\n</file>`;
            return context;
          });

          fileContext = `You have been provided with the following file(s) for context:\n\n${fileContents.join('\n\n')}\n\nPlease answer the user's question based on these files. Include relevant quotes or references from the files in your response.`;
        }
      }

      // 合并文件上下文到系统提示词
      const effectiveSettings = {
        ...settings,
        system: fileContext
          ? (settings.system ? `${fileContext}\n\n${settings.system}` : fileContext)
          : settings.system
      };

      // 过滤掉刚创建的空 assistant 占位消息（它的 id 是 assistantMessage.id）
      // 注意：用户消息已经通过 addMessage 添加到 conversation.messages 中了，无需再次添加
      const messages = conversation.messages.filter(
        msg => msg.id !== assistantMessage.id
      );

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

      // 使用包含文件上下文的 effectiveSettings
      for await (const event of chatAPI.streamChatCompletion(messages, effectiveSettings, apiConfig)) {
        if (event.error) {
          updateMessage(currentConversationId, assistantMessage.id, `Error: ${event.error}`, true);
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
          }, true);  // skipDbSync = true
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
                }, true);  // skipDbSync = true
              } else {
                // 还没找到 </think> 标签，暂时全部放入 reasoning_content
                updateMessage(currentConversationId, assistantMessage.id, {
                  content: '',
                  reasoning_content: fullContent,
                }, true);  // skipDbSync = true
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
                }, true);  // skipDbSync = true
              }
            }
          } else {
            // 不是推理模型，或已经有 API reasoning_content，正常显示
            updateMessage(currentConversationId, assistantMessage.id, fullContent, true);  // skipDbSync = true
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
              }, true);  // skipDbSync = true
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
        `Error: ${error.message || 'Unknown error occurred'}`,
        true  // skipDbSync = true
      );
    } finally {
      // 流式响应完成后（正常结束/人为停止/意外中断），一次性同步完整内容到数据库
      const finalConv = getCurrentConversation();
      const finalMessage = finalConv?.messages.find(m => m.id === assistantMessage.id);

      if (finalMessage) {
        console.log('[DB Sync] Syncing final message to database...');
        console.log('[DB Sync] Message ID:', assistantMessage.id);
        console.log('[DB Sync] Content length:', finalMessage.content?.length || 0);
        console.log('[DB Sync] Reasoning length:', finalMessage.reasoning_content?.length || 0);

        // 直接调用dbApi同步到数据库
        import('@/services/dbApi').then(({ addMessage: dbAddMessage }) => {
          dbAddMessage(currentConversationId, finalMessage).then(() => {
            console.log('[DB Sync] Successfully synced message to database');
          }).catch(err => {
            console.error('[DB Sync] Failed to sync final message to database:', err);
          });
        });
      }

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

    // Delete all messages after this one (to handle multi-turn conversations correctly)
    const messagesToDelete = conversation.messages.slice(messageIndex + 1);
    messagesToDelete.forEach((msg) => {
      deleteMessage(currentConversationId, msg.id);
    });

    // Find the last user message before this
    const userMessages = conversation.messages
      .slice(0, messageIndex)
      .filter((m) => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];

    if (lastUserMessage) {
      // Resend the last user message with its attachments (skip adding it again since it already exists)
      handleSendMessage(lastUserMessage.content, lastUserMessage.attachments || [], true);
    }
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    if (!currentConversationId) return;

    const conversation = getCurrentConversation();
    if (!conversation) return;

    // Find the message index
    const messageIndex = conversation.messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    // Get the original message to preserve attachments
    const originalMessage = conversation.messages[messageIndex];

    // Update the message content
    updateMessage(currentConversationId, messageId, newContent);

    // Delete all messages after this one
    const messagesToDelete = conversation.messages.slice(messageIndex + 1);
    messagesToDelete.forEach((msg) => {
      deleteMessage(currentConversationId, msg.id);
    });

    // Resend the edited message with original attachments (skip adding it again since we just updated it)
    setTimeout(() => {
      handleSendMessage(newContent, originalMessage.attachments || [], true);
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
