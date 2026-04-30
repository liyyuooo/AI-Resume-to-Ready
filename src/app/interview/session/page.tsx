'use client';

import { useState, useRef, useCallback, useSyncExternalStore, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, ArrowLeft, RotateCcw, Mic, MicOff, Loader2 } from 'lucide-react';
import { useResumeStore, useSettingsStore, useInterviewStore } from '@/store';
import { createLLM } from '@/lib/llm';
import { getInterviewSystemPrompt } from '@/lib/prompts';
import { useSpeechRecognition } from '@/lib/hooks/use-speech-recognition';
import { v4 as uuidv4 } from 'uuid';
import type { InterviewSession, InterviewType, Message, ChatCompletionMessage } from '@/types';

const interviewTypes: Record<InterviewType, string> = {
  'job-targeted': '岗位针对性问答',
  'resume-deep': '简历深度追问',
  behavioral: '行为面试题库',
  technical: '技术面试题',
};

function getWelcomeMessage(type: InterviewType, targetRole: string, name?: string): string {
  const greeting = name ? `你好，${name}！` : '你好！';

  const messages: Record<InterviewType, string> = {
    'job-targeted': `${greeting}我是你的面试官。今天我们来模拟一场针对${targetRole || '目标岗位'}的面试。准备好了吗？请简单介绍一下你自己。`,
    'resume-deep': `${greeting}我是你的面试官。我会根据你的简历内容进行深入提问。让我们从你最近的工作经历开始聊起吧。`,
    behavioral: `${greeting}我是你的面试官。今天我们来练习一些行为面试问题。这些问题通常用STAR法则来回答。准备好了吗？让我们开始第一个问题。`,
    technical: `${greeting}我是你的面试官。今天我们来练习一些技术问题。我会根据你的技术背景提出相应难度的问题。准备好了吗？`,
  };

  return messages[type];
}

function InterviewSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const resumeId = searchParams.get('resumeId') || '';
  const interviewType = (searchParams.get('type') || 'job-targeted') as InterviewType;
  const targetCompany = searchParams.get('company') || '';
  const targetRole = searchParams.get('role') || '';
  const jobDescription = searchParams.get('jd') ? decodeURIComponent(searchParams.get('jd')!) : '';

  const { getResume } = useResumeStore();
  const { settings } = useSettingsStore();
  const { saveSession } = useInterviewStore();

  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: uuidv4(),
      role: 'assistant',
      content: getWelcomeMessage(interviewType, targetRole),
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [session, setSession] = useState<InterviewSession | null>({
    id: uuidv4(),
    type: interviewType,
    resumeId,
    jobDescription,
    targetRole,
    targetCompany,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [voiceDraft, setVoiceDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 避免 SSR 水合问题
  const mounted = useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => true,
    () => false,
  );
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 语音识别
  const {
    isListening,
    isSupported: speechSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    language: 'zh-CN',
    continuous: true,
    onInterimResult: (text) => {
      setVoiceDraft(text);
    },
    onResult: (text) => {
      setVoiceDraft('');
      setInputMessage((prev) => `${prev}${prev ? ' ' : ''}${text.trim()}`);
    },
    onError: (error) => {
      console.error('Speech recognition error:', error);
      setVoiceDraft('');
    },
  });

  const voiceDisplayValue = !isListening || !voiceDraft
    ? inputMessage
    : `${inputMessage}${inputMessage ? ' ' : ''}${voiceDraft}`;


  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isGenerating || !settings?.apiKey) return;

    setErrorInfo(null);
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage('');
    setIsGenerating(true);
    setStreamingContent('');

    try {
      const resume = await getResume(resumeId);
      const llm = await createLLM({
        apiUrl: settings.apiUrl,
        apiKey: settings.apiKey,
        model: settings.model,
      });

      const systemPrompt = getInterviewSystemPrompt(
        interviewType,
        resume || null,
        jobDescription,
        targetRole,
        targetCompany
      );

      const chatMessages: ChatCompletionMessage[] = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const fullContent = await llm.chatWithSystem(systemPrompt, chatMessages);

      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: fullContent,
        timestamp: new Date().toISOString(),
      };

      setMessages([...newMessages, assistantMessage]);
      setStreamingContent('');
    } catch (error) {
      console.error('Chat error:', error);
      let errorMessage = '抱歉，发生了错误。';

      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();

        if (errorMsg.includes('api key') || errorMsg.includes('unauthorized') || errorMsg.includes('401')) {
          errorMessage = 'API Key 无效或已过期，请检查设置中的 API Key 配置。';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('超时')) {
          errorMessage = '请求超时，AI 模型响应时间较长，请稍后重试。';
        } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
          errorMessage = '网络连接失败，请检查网络或 API 地址是否正确。';
        } else if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
          errorMessage = 'API 调用频率超限，请稍后再试。';
        } else if (errorMsg.includes('解析') || errorMsg.includes('parse')) {
          errorMessage = 'AI 返回内容解析失败，请重试。';
        } else {
          errorMessage = `错误：${error.message}`;
        }
      }

      setErrorInfo(errorMessage);
      const errorMsgMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date().toISOString(),
      };
      setMessages([...newMessages, errorMsgMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEndSession = async () => {
    if (session) {
      await saveSession({
        ...session,
        messages,
        updatedAt: new Date().toISOString(),
      });
    }
    router.push('/interview');
  };

  const handleRestart = () => {
    setErrorInfo(null);
    setVoiceDraft('');
    setSession({
      id: uuidv4(),
      type: interviewType,
      resumeId,
      jobDescription,
      targetRole,
      targetCompany,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setMessages([
      {
        id: uuidv4(),
        role: 'assistant',
        content: getWelcomeMessage(interviewType, targetRole),
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col px-4 pb-8 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{interviewTypes[interviewType]}</h1>
            {targetRole && (
              <p className="mt-1 text-sm text-muted-foreground">{targetRole}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full" onClick={handleRestart}>
            <RotateCcw className="mr-2 h-4 w-4" />
            重新开始
          </Button>
          <Button className="rounded-full" onClick={handleEndSession}>
            结束面试
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {errorInfo && (
        <div className="mb-4 rounded-[1.5rem] bg-red-50 border border-red-200 px-5 py-3 text-sm text-red-700">
          {errorInfo}
        </div>
      )}

      {/* Chat Area */}
      <div className="soft-grid flex-1 overflow-hidden rounded-[2rem] border border-[#d5deca] bg-[#dce9d0]/40">
        <ScrollArea className="h-[calc(100vh-16rem)] p-6" ref={scrollAreaRef}>
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-[1.5rem] px-5 py-3 text-sm leading-7 ${
                    message.role === 'user'
                      ? 'bg-[#171412] text-[#f7eed8]'
                      : 'rounded-bl-[2rem] rounded-br-[1.5rem] rounded-tl-[0.5rem] bg-white text-[#231915] shadow-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            ))}

            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-[1.5rem] rounded-bl-[2rem] rounded-br-[1.5rem] rounded-tl-[0.5rem] bg-white px-5 py-3 text-sm leading-7 text-[#231915] shadow-sm">
                  <div className="whitespace-pre-wrap">{streamingContent}</div>
                </div>
              </div>
            )}

            {isGenerating && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-[1.5rem] bg-white px-5 py-3 text-sm text-muted-foreground shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI 正在思考中，可能需要 30~100 秒...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="mt-4 rounded-[2rem] border border-border/70 bg-white/95 p-4 shadow-sm">
        <div className="mx-auto flex max-w-3xl gap-3">
          {/* Voice Input Button */}
          {mounted && speechSupported && (
            <Button
              variant={isListening ? 'default' : 'outline'}
              size="icon"
              className={`rounded-full shrink-0 ${isListening ? 'bg-red-500 hover:bg-red-600' : ''}`}
              onClick={toggleVoiceInput}
              disabled={isGenerating}
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          )}

          <Input
            placeholder={mounted && isListening ? '正在聆听...' : '输入你的回答...'}
            value={voiceDisplayValue}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isGenerating}
            className="flex-1 rounded-full bg-[#fffaf0] px-5"
          />
          <Button
            className="rounded-full px-6"
            onClick={handleSendMessage}
            disabled={isGenerating || !inputMessage.trim()}
          >
            <Send className="mr-2 h-4 w-4" />
            发送
          </Button>
        </div>

        {/* Voice Input Status */}
        {mounted && isListening && (
          <div className="mt-2 text-center text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              正在录音，请说话...
            </span>
          </div>
        )}

        {/* Browser Not Supported */}
        {mounted && !speechSupported && (
          <div className="mt-2 text-center text-xs text-muted-foreground">
            当前浏览器不支持语音输入
          </div>
        )}
      </div>
    </div>
  );
}

export default function InterviewSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          加载中...
        </div>
      }
    >
      <InterviewSessionContent />
    </Suspense>
  );
}
