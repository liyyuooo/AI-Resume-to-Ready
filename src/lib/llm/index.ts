import type { ChatCompletionMessage, ContentPart } from '@/types';

export interface LLMProvider {
  chat(
    messages: ChatCompletionMessage[],
    onStream?: (chunk: string) => void
  ): Promise<string>;

  chatWithSystem(
    systemPrompt: string,
    messages: ChatCompletionMessage[],
    onStream?: (chunk: string) => void
  ): Promise<string>;
}

export interface LLMConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

// 预设的API URL
export const PRESET_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  claude: 'https://api.anthropic.com/v1/messages',
  bailian: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  qianfanOpenAI: 'https://qianfan.baidubce.com/v2/coding/chat/completions',
  qianfanAnthropic: 'https://qianfan.baidubce.com/anthropic/coding/v1/messages',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  moonshot: 'https://api.moonshot.cn/v1/chat/completions',
};

// 创建LLM实例
export async function createLLM(config: LLMConfig): Promise<LLMProvider> {
  if (!config.apiUrl || !config.apiKey || !config.model) {
    throw new Error('请先配置 API URL、API Key 和模型名称');
  }
  return new GenericLLMProvider(config);
}

// 通用LLM提供者 - 通过本地代理发送请求
class GenericLLMProvider implements LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async chat(
    messages: ChatCompletionMessage[],
    onStream?: (chunk: string) => void
  ): Promise<string> {
    return this.chatWithSystem('', messages, onStream);
  }

  async chatWithSystem(
    systemPrompt: string,
    messages: ChatCompletionMessage[],
    onStream?: (chunk: string) => void
  ): Promise<string> {
    const response = await fetch('/api/llm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiUrl: this.config.apiUrl,
        apiKey: this.config.apiKey,
        model: this.config.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        systemPrompt: systemPrompt || undefined,
        stream: !!onStream,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Anthropic 格式: data.content[0].text
    if (data.content?.[0]?.text) {
      return data.content[0].text;
    }

    // OpenAI 格式: data.choices[0].message.content
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }

    throw new Error('无法解析 API 响应');
  }
}
