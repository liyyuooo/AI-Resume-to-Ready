import { NextRequest, NextResponse } from 'next/server';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  apiUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  stream?: boolean;
}

function isAnthropicApi(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('anthropic.com') || lower.includes('/anthropic/');
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { apiUrl, apiKey, model, messages, systemPrompt, stream } = body;

    console.error('[LLM Proxy] Request received');
    console.error('  apiUrl:', apiUrl);
    console.error('  model:', model);
    console.error('  messages count:', messages?.length);
    console.error('  isAnthropic:', isAnthropicApi(apiUrl));

    if (!apiUrl || !apiKey || !model) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    if (isAnthropicApi(apiUrl)) {
      return await handleAnthropicRequest(apiUrl, apiKey, model, messages, systemPrompt, stream);
    } else {
      return await handleOpenAIRequest(apiUrl, apiKey, model, messages, systemPrompt, stream);
    }
  } catch (error) {
    console.error('[LLM Proxy] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '请求失败' },
      { status: 500 }
    );
  }
}

async function handleAnthropicRequest(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string,
  stream?: boolean
) {
  console.error('[LLM Proxy] Calling Anthropic API...');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt || undefined,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: stream || false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.text();
      console.error('[LLM Proxy] Anthropic API error:', response.status, error);
      return NextResponse.json(
        { error: `API error: ${response.status} - ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.error('[LLM Proxy] Anthropic API success');
    return NextResponse.json(data);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function handleOpenAIRequest(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string,
  stream?: boolean
) {
  console.error('[LLM Proxy] Calling OpenAI-compatible API...');

  const formattedMessages: ChatMessage[] = [];

  if (systemPrompt) {
    formattedMessages.push({ role: 'system', content: systemPrompt });
  }
  formattedMessages.push(...messages);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        stream: stream || false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.text();
      console.error('[LLM Proxy] OpenAI API error:', response.status, error);
      return NextResponse.json(
        { error: `API error: ${response.status} - ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.error('[LLM Proxy] OpenAI API success, response keys:', Object.keys(data));
    console.error('[LLM Proxy] Response content preview:', JSON.stringify(data).substring(0, 500));
    return NextResponse.json(data);
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[LLM Proxy] Request timeout');
      return NextResponse.json(
        { error: '请求超时，请重试' },
        { status: 504 }
      );
    }
    throw err;
  }
}
