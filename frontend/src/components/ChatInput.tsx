import React, { useState, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatInputProps {
  onSend: (message: string) => void;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;

    onSend(input.trim());
    setInput('');

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
        <div className="relative flex items-end gap-2">
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
              disabled={!input.trim() || disabled}
              className={clsx(
                'absolute right-2 bottom-3 p-2 rounded-lg transition-colors',
                input.trim() && !disabled
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
