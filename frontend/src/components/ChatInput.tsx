import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Paperclip, X, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { Attachment } from '@/types';
import { useChatStore } from '@/store';

interface ChatInputProps {
  onSend: (message: string, attachments?: Attachment[]) => void;
  onStop?: () => void;
  isGenerating?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onStop,
  isGenerating = false,
  disabled = false,
  placeholder = '输入消息... (Enter 发送，Shift+Enter 换行)',
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 验证文件大小
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        alert(`文件 "${file.name}" 超过10MB大小限制`);
        return;
      }
    }

    setIsUploading(true);
    try {
      const { uploadFile } = await import('@/services/api');
      const conversationId = useChatStore.getState().currentConversationId;

      if (!conversationId) {
        alert('请先创建或选择一个对话');
        return;
      }

      for (const file of files) {
        const attachment = await uploadFile(conversationId, file);
        setAttachments((prev) => [...prev, attachment]);
      }
    } catch (error: any) {
      alert(`文件上传失败: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = () => {
    if ((!input.trim() && attachments.length === 0) || disabled) return;

    onSend(input.trim(), attachments);
    setInput('');
    setAttachments([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* 附件显示区域 */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
              >
                <Paperclip className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-blue-900 dark:text-blue-100">
                  {att.name}
                </span>
                {att.parse_error && (
                  <span className="text-xs text-red-600" title={att.parse_error}>
                    ⚠️
                  </span>
                )}
                {att.truncated && (
                  <span className="text-xs text-amber-600" title="内容已截断">
                    ✂️
                  </span>
                )}
                <button
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  title="移除文件"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative flex items-end gap-2">
          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.pdf,.docx,.doc,.jpg,.jpeg,.png"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* 上传按钮 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              disabled || isUploading
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            )}
            title="上传文件"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Paperclip className="w-5 h-5" />
            )}
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={clsx(
              'flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600',
              'bg-white dark:bg-gray-800 px-4 py-3 pr-12 text-base',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'max-h-40 overflow-y-auto'
            )}
          />

          {isGenerating ? (
            <button
              onClick={onStop}
              className="absolute right-2 bottom-3 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              title="停止生成"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={(!input.trim() && attachments.length === 0) || disabled}
              className={clsx(
                'absolute right-2 bottom-3 p-2 rounded-lg transition-colors',
                (input.trim() || attachments.length > 0) && !disabled
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              )}
              title="发送消息"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="mt-2 text-sm text-gray-500 text-center">
          按 Enter 发送，Shift+Enter 换行
        </div>
      </div>
    </div>
  );
};
