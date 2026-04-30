'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { useSettingsStore } from '@/store';
import { createLLM, PRESET_URLS } from '@/lib/llm';

const PRESET_OPTIONS = [
  { value: 'custom', label: '自定义' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'qianfanOpenAI', label: '百度千帆（OpenAI 兼容）' },
  { value: 'qianfanAnthropic', label: '百度千帆（Anthropic 兼容）' },
  { value: 'zhipu', label: '智谱 AI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'moonshot', label: 'Moonshot (月之暗面)' },
];

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o',
  claude: 'claude-sonnet-4-20250514',
  qianfanOpenAI: 'ernie-4.5-8k-preview',
  qianfanAnthropic: 'claude-sonnet-4-20250514',
  zhipu: 'glm-4',
  deepseek: 'deepseek-chat',
  moonshot: 'moonshot-v1-8k',
};

export default function SettingsPage() {
  const router = useRouter();
  const { settings, loadSettings, updateSettings } = useSettingsStore();
  const [preset, setPreset] = useState('custom');
  const [apiUrl, setApiUrl] = useState(settings?.apiUrl || '');
  const [apiKey, setApiKey] = useState(settings?.apiKey || '');
  const [model, setModel] = useState(settings?.model || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const currentApiUrl = settings?.apiUrl || '';
  const matchedPreset = Object.entries(PRESET_URLS).find(([, url]) => url === currentApiUrl);
  const effectivePreset = matchedPreset ? matchedPreset[0] : 'custom';

  const handleTest = async () => {
    if (!apiKey.trim() || !apiUrl.trim() || !model.trim()) {
      setTestResult('error');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const llm = await createLLM({ apiUrl, apiKey, model });
      await llm.chat([{ role: 'user', content: 'Hello' }]);
      setTestResult('success');
    } catch (error) {
      console.error('Test error:', error);
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiUrl.trim() || !apiKey.trim() || !model.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await updateSettings({
        apiUrl,
        apiKey,
        model,
      });
      router.push('/');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <section className="paper-card px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="blob-sand flex h-12 w-12 items-center justify-center rounded-full">
              <Settings className="h-6 w-6 text-[#211915]" />
            </div>
            <div>
              <h1 className="text-4xl leading-tight">API 配置</h1>
              <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                配置你的 AI 模型 API，支持 OpenAI 兼容格式和 Anthropic API。
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="rounded-[2rem] border-border/70 bg-white/90 shadow-none">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="blob-lilac flex h-10 w-10 items-center justify-center rounded-[1rem]">
                <Settings className="h-5 w-5 text-[#211915]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">模型配置</h3>
                <p className="text-sm text-muted-foreground">选择预设或自定义</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>API 提供商</Label>
                <Select
                  value={preset || effectivePreset}
                  onValueChange={(v) => {
                    if (!v) return;
                    setPreset(v);
                    if (v !== 'custom' && PRESET_URLS[v]) {
                      setApiUrl(PRESET_URLS[v]);
                      setModel(DEFAULT_MODELS[v] || '');
                    }
                  }}
                >
                  <SelectTrigger className="rounded-[1.2rem] bg-[#fffaf0]">
                    <SelectValue placeholder="选择提供商或自定义" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>API URL</Label>
                <Input
                  placeholder="例如: https://api.openai.com/v1/chat/completions"
                  value={apiUrl}
                  onChange={(e) => {
                    setApiUrl(e.target.value);
                    if (preset !== 'custom') setPreset('custom');
                  }}
                  className="rounded-[1.2rem] bg-[#fffaf0]"
                />
                <p className="text-xs text-muted-foreground">
                  OpenAI 兼容格式 或 Anthropic API 地址；百度千帆可选 /v2/coding 或 /anthropic/coding
                </p>
              </div>

              <div className="space-y-2">
                <Label>模型名称</Label>
                <Input
                  placeholder="例如: gpt-4o, claude-sonnet-4-20250514, glm-4"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="rounded-[1.2rem] bg-[#fffaf0]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-white/90 shadow-none">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="blob-mint flex h-10 w-10 items-center justify-center rounded-[1rem]">
                <svg
                  className="h-5 w-5 text-[#211915]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold">API Key</h3>
                <p className="text-sm text-muted-foreground">你的密钥仅存储在本地</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder="输入你的 API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="rounded-[1.2rem] bg-[#fffaf0]"
                />
              </div>

              {testResult && (
                <div
                  className={`flex items-center gap-2 rounded-[1.2rem] px-4 py-3 text-sm ${
                    testResult === 'success'
                      ? 'bg-[#d9e7cf] text-[#1a3d12]'
                      : 'bg-[#f7d7d7] text-[#5c1212]'
                  }`}
                >
                  {testResult === 'success' ? (
                    <>
                      <Check className="h-4 w-4" />
                      API 连接成功
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4" />
                      API 连接失败，请检查配置
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={handleTest}
                  disabled={isTesting || !apiKey || !apiUrl || !model}
                >
                  {isTesting ? '验证中...' : '测试连接'}
                </Button>
                <Button
                  className="flex-1 rounded-full"
                  onClick={handleSave}
                  disabled={isSaving || !apiKey || !apiUrl || !model}
                >
                  {isSaving ? '保存中...' : '保存设置'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <div className="soft-grid rounded-[2rem] border border-[#c8d8bc]/80 bg-[#d9e7cf]/70 px-6 py-8 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="text-lg font-semibold text-[#211814]">数据安全说明</h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              你的 API Key、简历内容和面试记录均存储在浏览器本地 IndexedDB 中，
              不会上传到任何服务器。所有 AI 调用都直接从你的浏览器发送到对应的 API 服务。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
