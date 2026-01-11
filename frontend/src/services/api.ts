// API Service for ChatBox
import type { Message, ModelSettings, ChatStreamEvent, Model } from '@/types';

// In development (Vite dev server), use '/api' which gets proxied to backend
// In production (built and served by FastAPI), use '' for same-origin requests
const API_BASE_URL = import.meta.env.DEV ? '/api' : '';

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  seed?: number;
  stream?: boolean;
}

export interface APIConfig {
  baseUrl?: string;
  apiKey?: string;
}

export class ChatAPI {
  private abortController: AbortController | null = null;

  /**
   * Stream chat completion using SSE
   */
  async *streamChatCompletion(
    messages: Message[],
    settings: ModelSettings,
    apiConfig?: APIConfig
  ): AsyncGenerator<ChatStreamEvent, void, unknown> {
    this.abortController = new AbortController();

    // 构建messages数组，如果有system提示词，添加到开头
    const apiMessages = [];
    if (settings.system) {
      apiMessages.push({
        role: 'system',
        content: settings.system,
      });
    }
    apiMessages.push(...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })));

    const requestBody: any = {
      model: settings.model,
      messages: apiMessages,
      temperature: settings.temperature,
      top_p: settings.top_p,
      max_tokens: settings.max_tokens,
      stream: true,
    };

    // 处理额外参数
    if (settings.extraParams && settings.extraParams.length > 0) {
      settings.extraParams.forEach(param => {
        if (!param.enabled) return; // 跳过未启用的参数

        let parsedValue: any;
        try {
          switch (param.type) {
            case 'json':
              parsedValue = JSON.parse(param.value);
              break;
            case 'bool':
              parsedValue = param.value === 'true' || param.value === '1';
              break;
            case 'number':
              parsedValue = parseFloat(param.value);
              break;
            case 'text':
            default:
              parsedValue = param.value;
              break;
          }

          // 特殊处理 extra_body：展开其内容到请求体顶层
          // 模拟 OpenAI Python SDK 的行为
          if (param.name === 'extra_body' && typeof parsedValue === 'object') {
            Object.assign(requestBody, parsedValue);
            console.log('Expanded extra_body into request:', parsedValue);
          } else {
            requestBody[param.name] = parsedValue;
          }
        } catch (e) {
          console.warn(`Failed to parse extra param ${param.name}:`, e);
        }
      });
    }

    // 确定使用的 baseUrl，并规范化路径
    let baseUrl = apiConfig?.baseUrl || API_BASE_URL;

    // 移除末尾的斜杠
    baseUrl = baseUrl.replace(/\/+$/, '');

    // 统一拼接 /chat/completions
    const endpoint = `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 如果提供了 apiKey，添加 Authorization header
    if (apiConfig?.apiKey) {
      headers['Authorization'] = `Bearer ${apiConfig.apiKey}`;
    }

    console.log('Calling API endpoint:', endpoint);
    console.log('Request body:', requestBody);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is null');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            if (!data || data === '[DONE]') {
              yield { done: true };
              return;
            }

            try {
              // 处理 OpenAI 格式的流式响应
              const parsed = JSON.parse(data);

              // 检查是否是标准 OpenAI streaming 格式
              if (parsed.choices && parsed.choices[0]) {
                const choice = parsed.choices[0];
                const delta = choice.delta || {};

                // 提取推理内容（DeepSeek Reasoner）
                if (delta.reasoning_content) {
                  yield { reasoning_delta: delta.reasoning_content };
                }

                // 提取普通内容
                if (delta.content) {
                  yield { delta: delta.content };
                }

                // 检查是否结束
                if (choice.finish_reason) {
                  yield { done: true, finish_reason: choice.finish_reason };
                  return;
                }
              } else if (parsed.delta) {
                // 兼容自定义格式
                yield { delta: parsed.delta };
              } else if (parsed.done) {
                yield { done: true };
                return;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', data, e);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        yield { done: true, finish_reason: 'stopped' };
      } else {
        yield { error: error.message || 'Unknown error occurred' };
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Non-streaming chat completion
   */
  async chatCompletion(
    messages: Message[],
    settings: ModelSettings
  ): Promise<string> {
    // 构建messages数组，如果有system提示词，添加到开头
    const apiMessages = [];
    if (settings.system) {
      apiMessages.push({
        role: 'system',
        content: settings.system,
      });
    }
    apiMessages.push(...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })));

    const requestBody: ChatCompletionRequest = {
      model: settings.model,
      messages: apiMessages,
      temperature: settings.temperature,
      top_p: settings.top_p,
      max_tokens: settings.max_tokens,
      stream: false,
    };

    const response = await fetch(`${API_BASE_URL}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  /**
   * List available models
   */
  async listModels(): Promise<Model[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/models`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch models:', error);
      // Return default models on error
      return [
        { id: 'gpt-5.2-pro', object: 'model' },
        { id: 'gpt-5.2', object: 'model' },
      ];
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      return data.ok === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Stop current generation
   */
  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

export const chatAPI = new ChatAPI();
