import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, User, Bot, Settings as SettingsIcon, Edit2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import type { Message as MessageType } from '@/types';
import { copyToClipboard, formatTimestamp } from '@/utils/format';
import { clsx } from 'clsx';

interface MessageProps {
  message: MessageType;
  isReasoningModel?: boolean; // 是否是推理模型
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRegenerate?: (messageId: string) => void;
}

/**
 * 解析消息内容，提取推理过程和最终内容
 *
 * 逻辑：
 * 1. 如果有完整的 <think>...</think> 标签，提取其中的内容作为推理过程
 * 2. 如果是推理模型 + 只有 </think> 标签（没有开始标签），则 </think> 之前的内容作为推理过程
 * 3. 其他情况，作为正常内容处理
 */
function parseReasoningContent(
  content: string,
  isReasoningModel: boolean
): {
  reasoning: string | null;
  finalContent: string;
} {
  const hasOpenTag = content.includes('<think>');
  const hasCloseTag = content.includes('</think>');

  // 情况1: 完整的 <think>...</think> 标签
  if (hasOpenTag && hasCloseTag) {
    const fullThinkRegex = /<think>([\s\S]*?)<\/think>/i;
    const fullMatch = content.match(fullThinkRegex);

    if (fullMatch) {
      return {
        reasoning: fullMatch[1].trim(),
        finalContent: content.replace(fullThinkRegex, '').trim(),
      };
    }
  }

  // 情况2: 只有 </think> 标签，且是推理模型
  if (!hasOpenTag && hasCloseTag && isReasoningModel) {
    const closeTagIndex = content.indexOf('</think>');
    return {
      reasoning: content.substring(0, closeTagIndex).trim(),
      finalContent: content.substring(closeTagIndex + '</think>'.length).trim(),
    };
  }

  // 情况3: 没有推理标签，或不是推理模型 - 正常显示
  return {
    reasoning: null,
    finalContent: content,
  };
}

export const Message: React.FC<MessageProps> = ({
  message,
  isReasoningModel = false,
  onEditMessage,
  onRegenerate,
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);

  // 解析推理内容
  const { reasoning, finalContent } = useMemo(() => {
    // 调试日志
    if (message.role === 'assistant') {
      console.log('=== Message Display Debug ===');
      console.log('has reasoning_content:', !!message.reasoning_content);
      console.log('reasoning_content length:', message.reasoning_content?.length || 0);
      console.log('content length:', message.content.length);
      console.log('content preview:', message.content.substring(0, 100));
    }

    // 直接使用 message 中的字段
    // App.tsx 中的流式处理已经正确分离了 reasoning_content 和 content
    const result = {
      reasoning: message.reasoning_content || null,
      finalContent: message.content,
    };

    if (message.role === 'assistant') {
      console.log('Display reasoning:', result.reasoning ? `${result.reasoning.length} chars` : 'null');
      console.log('Display content:', `${result.finalContent.length} chars`);
      console.log('===========================');
    }

    return result;
  }, [message.content, message.reasoning_content]);

  const handleCopyCode = async (code: string) => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const handleCopyMessage = async () => {
    const success = await copyToClipboard(message.content);
    if (success) {
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    }
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditContent(message.content);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && onEditMessage) {
      onEditMessage(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(message.content);
  };

  const roleIcons = {
    user: <User className="w-5 h-5" />,
    assistant: <Bot className="w-5 h-5" />,
    system: <SettingsIcon className="w-5 h-5" />,
    tool: <SettingsIcon className="w-5 h-5" />,
  };

  const roleColors = {
    user: 'bg-blue-500',
    assistant: 'bg-green-500',
    system: 'bg-gray-500',
    tool: 'bg-purple-500',
  };

  const roleNames: Record<string, string> = {
    user: '用户',
    assistant: '助手',
    system: '系统',
    tool: '工具',
  };

  return (
    <div
      className={clsx(
        'group flex gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
        message.role === 'user' && 'bg-gray-50/50 dark:bg-gray-800/30'
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white',
          roleColors[message.role]
        )}
      >
        {roleIcons[message.role]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-base">{roleNames[message.role]}</span>
          <span className="text-sm text-gray-500">
            {formatTimestamp(message.createdAt)}
          </span>
        </div>

        {/* 编辑模式 */}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-base resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={Math.max(3, editContent.split('\n').length)}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium"
              >
                保存并重新生成
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-sm font-medium"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 推理过程（折叠显示） */}
            {reasoning && (
              <div className="mb-4 border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden bg-amber-50 dark:bg-amber-900/20">
                <button
                  onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="font-medium text-amber-800 dark:text-amber-200 text-base">
                      推理过程
                    </span>
                  </div>
                  {isReasoningExpanded ? (
                    <ChevronUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  )}
                </button>

                {isReasoningExpanded && (
                  <div className="px-4 py-3 border-t border-amber-200 dark:border-amber-800">
                    <div className="prose dark:prose-invert max-w-none prose-sm">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            const code = String(children).replace(/\n$/, '');

                            return !inline && match ? (
                              <div className="relative group/code">
                                <SyntaxHighlighter
                                  style={oneDark as any}
                                  language={match[1]}
                                  PreTag="div"
                                  className="rounded-lg !mt-2 !mb-4"
                                  {...props}
                                >
                                  {code}
                                </SyntaxHighlighter>
                                <button
                                  onClick={() => handleCopyCode(code)}
                                  className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded text-white opacity-0 group-hover/code:opacity-100 transition-opacity"
                                  title="复制代码"
                                >
                                  {copiedCode === code ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {reasoning}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 最终内容 */}
            <div className="prose dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const code = String(children).replace(/\n$/, '');

                    return !inline && match ? (
                      <div className="relative group/code">
                        <SyntaxHighlighter
                          style={oneDark as any}
                          language={match[1]}
                          PreTag="div"
                          className="rounded-lg !mt-2 !mb-4"
                          {...props}
                        >
                          {code}
                        </SyntaxHighlighter>
                        <button
                          onClick={() => handleCopyCode(code)}
                          className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded text-white opacity-0 group-hover/code:opacity-100 transition-opacity"
                          title="复制代码"
                        >
                          {copiedCode === code ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                  a({ node, children, ...props }) {
                    return (
                      <a {...props} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {finalContent}
              </ReactMarkdown>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              {/* 复制按钮 */}
              <button
                onClick={handleCopyMessage}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                title="复制内容"
              >
                {copiedMessage ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>复制</span>
                  </>
                )}
              </button>

              {/* 用户消息：编辑按钮 */}
              {message.role === 'user' && onEditMessage && (
                <button
                  onClick={handleStartEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  title="编辑并重新生成"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>编辑</span>
                </button>
              )}

              {/* 助手消息：重新生成按钮 */}
              {message.role === 'assistant' && onRegenerate && (
                <button
                  onClick={() => onRegenerate(message.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  title="重新生成回答"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>重新生成</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
