'use client';

import { useState, useEffect, useRef, useMemo, useCallback, useSyncExternalStore, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Sparkles, Loader2, ArrowRight, FileText, Mic, MicOff } from 'lucide-react';
import { useSettingsStore, useResumeStore } from '@/store';
import { createLLM } from '@/lib/llm';
import { RESUME_PARSE_PROMPT, RESUME_GUIDE_SYSTEM_PROMPT } from '@/lib/prompts';
import { parseResumeFile, isSupportedFileType } from '@/lib/resume-parser';
import { saveExperiencePoolItemsBatch } from '@/lib/db';
import { useSpeechRecognition } from '@/lib/hooks/use-speech-recognition';
import { v4 as uuidv4 } from 'uuid';
import type { Resume, ExperiencePoolItem, ChatCompletionMessage, ContentPart } from '@/types';

const getContentText = (content: string | ContentPart[]): string => {
  if (typeof content === 'string') return content;
  return content.filter((p) => p.type === 'text').map((p) => p.text).join('');
};

function NewResumeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') || 'import';
  const { settings, hasHydrated } = useSettingsStore();
  const { saveResume } = useResumeStore();

  const [resumeText, setResumeText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialGuidedMessage = useMemo<ChatCompletionMessage[]>(() => {
    if (mode !== 'create') {
      return [];
    }

    return [{
      role: 'assistant',
      content: '你好！我是你的职业顾问，很高兴帮助你创建简历。让我先了解一下你的基本情况。请问你的姓名是什么？',
    }];
  }, [mode]);

  const [messages, setMessages] = useState<ChatCompletionMessage[]>(initialGuidedMessage);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReadyToGenerate, setIsReadyToGenerate] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 避免 SSR 水合问题
  const mounted = useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => true,
    () => false,
  );

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

  const toggleVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSupportedFileType(file)) {
      setParseError('支持的格式: PDF, Word (.doc, .docx), 文本文件 (.txt)');
      return;
    }

    setUploadedFile(file);
    setIsParsing(true);
    setParseError(null);

    try {
      const text = await parseResumeFile(file);
      setResumeText(text);
    } catch (error) {
      console.error('File parse error:', error);
      setParseError('文件解析失败，请尝试复制粘贴内容');
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!resumeText.trim()) return;
    if (!hasHydrated) {
      setParseError('页面正在初始化，请稍后再试。');
      return;
    }
    if (!settings?.apiKey) {
      setParseError('请先前往设置页面配置 API Key，否则无法解析简历内容。');
      return;
    }

    setIsParsing(true);
    setParseError(null);

    try {
      const llm = await createLLM({
        apiUrl: settings.apiUrl,
        apiKey: settings.apiKey,
        model: settings.model,
      });

      const response = await llm.chatWithSystem(RESUME_PARSE_PROMPT, [
        { role: 'user', content: resumeText },
      ]);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析简历内容');
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      const now = new Date().toISOString();

      // 构建经历池条目
      const experienceItems: ExperiencePoolItem[] = [];
      const projectItems: ExperiencePoolItem[] = [];

      if (Array.isArray(parsedData.experience)) {
        for (const e of parsedData.experience) {
          experienceItems.push({
            id: uuidv4(),
            type: 'experience',
            company: e.company || '',
            title: e.title || '',
            startDate: e.startDate || '',
            endDate: e.endDate || '',
            location: e.location || '',
            responsibilities: e.responsibilities || [],
            achievements: e.achievements || [],
            source: 'upload',
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      if (Array.isArray(parsedData.projects)) {
        for (const p of parsedData.projects) {
          projectItems.push({
            id: uuidv4(),
            type: 'project',
            name: p.name || '',
            role: p.role || '',
            description: p.description || '',
            technologies: p.technologies || [],
            highlights: p.highlights || [],
            source: 'upload',
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // 批量保存到经历池
      await saveExperiencePoolItemsBatch([...experienceItems, ...projectItems]);

      const experienceIds = experienceItems.map((e) => e.id);
      const projectIds = projectItems.map((p) => p.id);

      const resume: Resume = {
        id: uuidv4(),
        name: `${parsedData.basicInfo?.name || '未命名'}的简历`,
        createdAt: now,
        updatedAt: now,
        basicInfo: parsedData.basicInfo || {
          name: '',
          email: '',
          phone: '',
          location: '',
          links: [],
        },
        education: parsedData.education?.map((e: Partial<Resume['education'][0]>) => ({
          id: uuidv4(),
          school: e.school || '',
          degree: e.degree || '',
          major: e.major || '',
          startDate: e.startDate || '',
          endDate: e.endDate || '',
          highlights: e.highlights || [],
        })) || [],
        experienceIds,
        projectIds,
        skills: parsedData.skills?.map((s: Partial<Resume['skills'][0]>) => ({
          id: uuidv4(),
          category: s.category || '',
          items: s.items || [],
        })) || [],
      };

      await saveResume(resume);
      router.push(`/resume/${resume.id}`);
    } catch (error) {
      console.error('Parse error:', error);
      setParseError(error instanceof Error ? error.message : '解析失败，请重试');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !settings?.apiKey || isGenerating) return;

    const userMessage: ChatCompletionMessage = {
      role: 'user',
      content: inputMessage,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage('');
    setIsGenerating(true);

    try {
      const llm = await createLLM({
        apiUrl: settings.apiUrl,
        apiKey: settings.apiKey,
        model: settings.model,
      });

      const response = await llm.chatWithSystem(
        RESUME_GUIDE_SYSTEM_PROMPT,
        newMessages.map((m) => ({ role: m.role, content: m.content }))
      );

      setMessages([
        ...newMessages,
        { role: 'assistant', content: response },
      ]);

      if (response.includes('生成简历') || response.includes('创建简历')) {
        setIsReadyToGenerate(true);
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateResume = async () => {
    if (!settings?.apiKey) return;

    setIsGenerating(true);

    try {
      const llm = await createLLM({
        apiUrl: settings.apiUrl,
        apiKey: settings.apiKey,
        model: settings.model,
      });

      const generatePrompt: ChatCompletionMessage = {
        role: 'user',
        content: '请根据我们之前的对话，生成我的简历JSON。只需要输出JSON，不要其他内容。',
      };

      const allMessages = [...messages, generatePrompt];
      const response = await llm.chatWithSystem(
        RESUME_GUIDE_SYSTEM_PROMPT + '\n\n现在请根据对话内容，生成结构化的简历JSON。',
        allMessages
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法生成简历');
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      const now = new Date().toISOString();

      // 构建经历池条目
      const experienceItems: ExperiencePoolItem[] = [];
      const projectItems: ExperiencePoolItem[] = [];

      if (Array.isArray(parsedData.experience)) {
        for (const e of parsedData.experience) {
          experienceItems.push({
            id: uuidv4(),
            type: 'experience',
            company: e.company || '',
            title: e.title || '',
            startDate: e.startDate || '',
            endDate: e.endDate || '',
            location: e.location || '',
            responsibilities: e.responsibilities || [],
            achievements: e.achievements || [],
            source: 'upload',
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      if (Array.isArray(parsedData.projects)) {
        for (const p of parsedData.projects) {
          projectItems.push({
            id: uuidv4(),
            type: 'project',
            name: p.name || '',
            role: p.role || '',
            description: p.description || '',
            technologies: p.technologies || [],
            highlights: p.highlights || [],
            source: 'upload',
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // 批量保存到经历池
      await saveExperiencePoolItemsBatch([...experienceItems, ...projectItems]);

      const experienceIds = experienceItems.map((e) => e.id);
      const projectIds = projectItems.map((p) => p.id);

      const resume: Resume = {
        id: uuidv4(),
        name: `${parsedData.basicInfo?.name || '未命名'}的简历`,
        createdAt: now,
        updatedAt: now,
        basicInfo: parsedData.basicInfo || {
          name: '',
          email: '',
          phone: '',
          location: '',
          links: [],
        },
        education: parsedData.education?.map((e: Partial<Resume['education'][0]>) => ({
          id: uuidv4(),
          school: e.school || '',
          degree: e.degree || '',
          major: e.major || '',
          startDate: e.startDate || '',
          endDate: e.endDate || '',
          highlights: e.highlights || [],
        })) || [],
        experienceIds,
        projectIds,
        skills: parsedData.skills?.map((s: Partial<Resume['skills'][0]>) => ({
          id: uuidv4(),
          category: s.category || '',
          items: s.items || [],
        })) || [],
      };

      await saveResume(resume);
      router.push(`/resume/${resume.id}`);
    } catch (error) {
      console.error('Generate error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      {/* Header */}
      <div className="paper-card px-6 py-8 sm:px-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="blob-mint mb-4 h-12 w-12 rounded-full shadow-lg" />
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">构建你的简历素材</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
              可以上传现有简历快速解析，也可以像和顾问聊天一样，从经历回忆开始慢慢生成初稿。
            </p>
          </div>
        </div>

        <Tabs defaultValue={mode} className="w-full">
          <TabsList className="grid h-14 w-full grid-cols-2 rounded-full bg-[#e8dfcb] p-1">
            <TabsTrigger value="import" className="rounded-full text-base data-[state=active]:bg-[#171412] data-[state=active]:text-[#f7eed8]">
              <Upload className="mr-2 h-4 w-4" />
              导入简历
            </TabsTrigger>
            <TabsTrigger value="create" className="rounded-full text-base data-[state=active]:bg-[#171412] data-[state=active]:text-[#f7eed8]">
              <Sparkles className="mr-2 h-4 w-4" />
              AI创建
            </TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="import" className="mt-6">
            <Card className="rounded-[2rem] border-border/70 bg-white/90 shadow-none">
              <CardHeader>
                <CardTitle className="text-2xl">导入已有简历</CardTitle>
                <CardDescription>上传 PDF / Word / 文本文件，或直接粘贴内容后交给 AI 解析。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Upload Area */}
                <div
                  className="card-hover cursor-pointer rounded-[1.8rem] border-2 border-dashed border-border bg-[#f7efde] p-10 text-center transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="mx-auto blob-lilac flex h-20 w-20 items-center justify-center rounded-[1.5rem] shadow-lg">
                    <Upload className="h-8 w-8 text-[#211915]" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold">拖拽或点击上传文件</h3>
                  <p className="mt-2 text-sm text-muted-foreground">支持 PDF、DOC、DOCX、TXT</p>
                  {uploadedFile && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium shadow-sm">
                      <FileText className="h-4 w-4" />
                      {uploadedFile.name}
                    </div>
                  )}
                  {isParsing && (
                    <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在读取文件...
                    </div>
                  )}
                </div>

                {/* Text Area */}
                <div className="space-y-2">
                  <Label>简历内容</Label>
                  <Textarea
                    placeholder="粘贴你的简历内容..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    rows={14}
                    className="rounded-[1.4rem] bg-[#fffaf0] text-sm leading-7"
                  />
                </div>

                {parseError && (
                  <div className="rounded-[1.2rem] bg-red-50 px-4 py-3 text-sm text-destructive">
                    {parseError}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button
                    className="rounded-full px-6"
                    onClick={handleImport}
                    disabled={isParsing || !resumeText.trim()}
                  >
                    {isParsing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        解析中...
                      </>
                    ) : (
                      <>
                        开始解析
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button variant="outline" className="rounded-full px-6" onClick={() => router.back()}>
                    返回
                  </Button>
                </div>
                {!settings?.apiKey && (
                  <p className="text-xs text-amber-600 mt-2">
                    提示：点击解析前请先
                    <button
                      className="underline font-medium mx-1"
                      onClick={() => router.push('/settings')}
                    >
                      配置 API Key
                    </button>
                    ，否则解析按钮没有反应。
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Create Tab */}
          <TabsContent value="create" className="mt-6">
            <Card className="rounded-[2rem] border-border/70 bg-white/90 shadow-none">
              <CardHeader>
                <CardTitle className="text-2xl">AI 引导创建简历</CardTitle>
                <CardDescription>从姓名、教育、项目、成果开始，一步步帮你把经历变成可以投递的版本。</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
                  {/* Guide Panel */}
                  <div className="soft-grid rounded-[1.8rem] border border-[#d5deca] bg-[#dce9d0]/50 p-6">
                    <div className="rounded-[1.5rem] bg-[#f8f1df] p-5 shadow-sm">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="blob-sand h-8 w-8 rounded-[0.7rem]" />
                        <h3 className="text-lg font-semibold">创建方式</h3>
                      </div>
                      <p className="text-sm leading-7 text-muted-foreground">
                        你只需要像讲故事一样描述自己的经历，我会继续追问数字、职责、结果与技术细节，最后自动组装简历结构。
                      </p>
                    </div>
                  </div>

                  {/* Chat Panel */}
                  <div className="rounded-[1.8rem] border border-border/70 bg-[#fffaf0] p-4">
                    <div className="mb-4 space-y-4">
                      {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-[1.3rem] px-4 py-3 text-sm leading-7 ${msg.role === 'user' ? 'bg-[#171412] text-[#f7eed8]' : 'bg-white text-[#231915] shadow-sm'}`}>
                            {getContentText(msg.content)}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    <div className="flex gap-2">
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
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        disabled={isGenerating}
                        className="rounded-full bg-white"
                      />
                      <Button className="rounded-full px-5" onClick={handleSendMessage} disabled={isGenerating || !inputMessage.trim()}>
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

                    {isReadyToGenerate && (
                      <Button className="mt-4 rounded-full px-6" onClick={handleGenerateResume} disabled={isGenerating}>
                        生成简历
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function NewResumePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          加载中...
        </div>
      }
    >
      <NewResumeContent />
    </Suspense>
  );
}
