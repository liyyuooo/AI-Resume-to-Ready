'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Trash2, Sparkles, Plus, ImageIcon } from 'lucide-react';
import { useJDHistoryStore, useExperiencePoolStore, useResumeStore, useSettingsStore } from '@/store';
import { createLLM } from '@/lib/llm';
import { getTailoredResumePrompt } from '@/lib/prompts';
import { saveExperiencePoolItem } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import Tesseract from 'tesseract.js';
import type { JDHistoryRecord, ExperiencePoolItem, Resume } from '@/types';

export default function TargetJobsPage() {
  const router = useRouter();
  const { records, loadHistory, addRecord, removeRecord } = useJDHistoryStore();
  const { items: poolItems, loadItems: loadPool } = useExperiencePoolStore();
  const { resumes, loadResumes, saveResume } = useResumeStore();
  const { settings } = useSettingsStore();

  const [mounted, setMounted] = useState(false);
  const [isCreating, setIsCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTargetRole, setNewTargetRole] = useState('');
  const [newTargetCompany, setNewTargetCompany] = useState('');
  const [newJD, setNewJD] = useState('');
  const [isExtractingJD, setIsExtractingJD] = useState(false);
  const [uploadedImageName, setUploadedImageName] = useState('');

  useEffect(() => {
    setMounted(true);
    loadHistory();
    loadPool();
    loadResumes();
  }, [loadHistory, loadPool, loadResumes]);

  if (!mounted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  const handleCreateResume = async (record: JDHistoryRecord) => {
    if (!settings?.apiKey || poolItems.length === 0) return;

    setIsCreating(record.id);
    setError(null);

    try {
      const llm = await createLLM({
        apiUrl: settings.apiUrl,
        apiKey: settings.apiKey,
        model: settings.model,
      });

      // 从现有简历中获取基本信息和教育背景
      const latestResume = resumes[0];
      const existingBasicInfo = latestResume?.basicInfo;
      const existingEducation = latestResume?.education;
      const existingSkills = latestResume?.skills;

      const prompt = getTailoredResumePrompt(
        record.jobDescription,
        record.targetRole || '',
        record.targetCompany || '',
        poolItems.map((item) => ({
          id: item.id,
          type: item.type,
          company: item.company,
          title: item.title,
          startDate: item.startDate,
          endDate: item.endDate,
          location: item.location,
          responsibilities: item.responsibilities,
          achievements: item.achievements,
          name: item.name,
          role: item.role,
          description: item.description,
          technologies: item.technologies,
          highlights: item.highlights,
        })),
        existingBasicInfo ? {
          name: existingBasicInfo.name || '',
          email: existingBasicInfo.email || '',
          phone: existingBasicInfo.phone || '',
          location: existingBasicInfo.location || '',
        } : undefined,
        existingEducation?.map((e) => ({
          school: e.school,
          degree: e.degree,
          major: e.major,
          startDate: e.startDate,
          endDate: e.endDate,
          highlights: e.highlights,
        })),
        existingSkills?.map((s) => ({
          category: s.category,
          items: s.items,
        })),
      );

      const response = await llm.chatWithSystem(prompt, []);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析 AI 返回的简历数据');
      }

      const result = JSON.parse(jsonMatch[0]);
      const now = new Date().toISOString();

      // 更新经历池中的条目（使用优化后的内容）
      const optimizedExpItems = result.optimizedExperienceItems || [];
      const optimizedProjItems = result.optimizedProjectItems || [];
      const selectedExpIds: string[] = result.selectedExperienceIds || [];
      const selectedProjIds: string[] = result.selectedProjectIds || [];

      // 保存优化后的经历到池
      for (const item of [...optimizedExpItems, ...optimizedProjItems]) {
        await saveExperiencePoolItem({
          ...item,
          source: 'upload',
          updatedAt: now,
        } as ExperiencePoolItem);
      }

      // 创建新简历
      const resume: Resume = {
        id: uuidv4(),
        name: `${existingBasicInfo?.name || '候选人'} - ${record.targetRole || record.targetCompany || '定制简历'}`,
        createdAt: now,
        updatedAt: now,
        basicInfo: existingBasicInfo || {
          name: '',
          email: '',
          phone: '',
          location: '',
          links: [],
        },
        education: existingEducation || [],
        experienceIds: selectedExpIds,
        projectIds: selectedProjIds,
        skills: (result.skills || existingSkills || []).map((s: { id?: string; category: string; items: string[] }) => ({
          ...s,
          id: s.id || uuidv4(),
        })),
      };

      await saveResume(resume);
      router.push(`/resume/${resume.id}`);
    } catch (err) {
      console.error('Create tailored resume error:', err);
      setError(err instanceof Error ? err.message : '创建简历失败，请重试');
    } finally {
      setIsCreating(null);
    }
  };

  const runOCR = async (files: File[]): Promise<string> => {
    const texts: string[] = [];
    for (const file of files) {
      const { data: { text } } = await Tesseract.recognize(file, 'chi_sim+eng');
      if (text.trim()) texts.push(text.trim());
    }
    return texts.join('\n\n---\n\n');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadedImageName(files.length === 1 ? files[0].name : `${files.length} 张图片`);
    setIsExtractingJD(true);
    setError(null);

    try {
      // 1. OCR 提取原始文本
      const rawText = await runOCR(files);
      if (!rawText.trim()) {
        setError('未能从图片中识别到文字内容，请手动输入');
        return;
      }

      // 2. 如果配置了 API，用 AI 整理格式
      if (settings?.apiKey) {
        try {
          const llm = await createLLM({
            apiUrl: settings.apiUrl,
            apiKey: settings.apiKey,
            model: settings.model,
          });

          const response = await llm.chatWithSystem(
            '你是一个专业的简历助手。请将以下 OCR 识别出的岗位描述原始文本整理为清晰、结构化的 JD。保持原有信息完整，去除 OCR 噪声（多余的空格、换行、乱码字符），恢复正常的段落和列表结构。只输出整理后的 JD 文本。',
            [{ role: 'user', content: rawText }],
          );

          const cleaned = response.trim();
          setNewJD(cleaned);
          const lines = cleaned.split('\n').filter(Boolean);
          const firstLine = lines[0] || '';
          if (firstLine.length < 40 && !newTargetRole) {
            setNewTargetRole(firstLine);
          }
        } catch {
          // AI 整理失败，直接用 OCR 原文
          setNewJD(rawText);
        }
      } else {
        setNewJD(rawText);
      }
    } catch (err) {
      console.error('JD image extraction error:', err);
      const msg = err instanceof Error ? err.message : '';
      setError(msg || '图片识别失败，请重试');
    } finally {
      setIsExtractingJD(false);
      e.target.value = '';
    }
  };

  const handleAddRecord = async () => {
    if (!newJD.trim()) return;
    await addRecord({
      id: uuidv4(),
      title: newJD.trim().replace(/\n/g, ' ').substring(0, 50),
      targetRole: newTargetRole || undefined,
      targetCompany: newTargetCompany || undefined,
      jobDescription: newJD.trim(),
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    });
    setNewJD('');
    setNewTargetRole('');
    setNewTargetCompany('');
    setShowAddForm(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      {/* Header */}
      <section className="paper-card px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="blob-lilac h-12 w-12 rounded-full shadow-lg" />
            <div>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight">目标岗位列表</h1>
              <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                管理你的目标岗位，AI 会从经历池中挑选最匹配的经历，创建针对特定 JD 的定制简历。
              </p>
            </div>
          </div>
          <Button className="rounded-full px-5" onClick={() => setShowAddForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加目标岗位
          </Button>
        </div>
      </section>

      {/* Add Form */}
      {showAddForm && (
        <Card className="mt-6 rounded-[1.8rem] border-border/70 bg-white/90">
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>目标公司</Label>
                <Input
                  value={newTargetCompany}
                  onChange={(e) => setNewTargetCompany(e.target.value)}
                  placeholder="如：字节跳动"
                  className="rounded-[1.2rem] bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label>目标岗位</Label>
                <Input
                  value={newTargetRole}
                  onChange={(e) => setNewTargetRole(e.target.value)}
                  placeholder="如：高级前端工程师"
                  className="rounded-[1.2rem] bg-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>岗位描述（JD）</Label>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isExtractingJD}
                  />
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                    isExtractingJD
                      ? 'border-[#d8ccff]/40 bg-[#f8f4ff] text-[#3d342f]/50'
                      : 'border-[#d8ccff]/60 bg-white/80 text-[#3d342f] hover:bg-[#d8ccff]/20'
                  }`}>
                    {isExtractingJD ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        识别中...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-3 w-3" />
                        上传截图识别
                      </>
                    )}
                  </span>
                </label>
              </div>
              {uploadedImageName && (
                <p className="text-xs text-muted-foreground">已上传：{uploadedImageName}</p>
              )}
              <Textarea
                value={newJD}
                onChange={(e) => setNewJD(e.target.value)}
                placeholder={isExtractingJD ? 'AI 正在识别图片中的 JD...' : '粘贴目标岗位的 JD 内容，或点击右上角上传截图自动识别'}
                rows={6}
                className="rounded-[1.4rem] bg-white"
                disabled={isExtractingJD}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" className="rounded-full" onClick={() => setShowAddForm(false)}>
                取消
              </Button>
              <Button className="rounded-full" onClick={handleAddRecord} disabled={!newJD.trim()}>
                保存
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-[1.5rem] bg-red-50 border border-red-200 px-5 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Pool Status */}
      {poolItems.length === 0 && (
        <div className="mt-4 rounded-[1.5rem] bg-amber-50 border border-amber-200 px-5 py-3 text-sm text-amber-700">
          经验池为空，建议先
          <button className="underline font-medium mx-1" onClick={() => router.push('/resume/new?mode=import')}>
            上传简历
          </button>
          将经历加入经验池，或
          <button className="underline font-medium mx-1" onClick={() => router.push('/experience-pool')}>
            手动添加经历
          </button>
          。
        </div>
      )}

      {/* JD History List */}
      <section className="mt-8">
        {records.length === 0 ? (
          <div className="paper-card px-6 py-12 text-center">
            <div className="mx-auto blob-mint h-24 w-24 rounded-[40%_60%_55%_45%/45%_45%_55%_55%] shadow-lg" />
            <h2 className="mt-8 text-2xl font-semibold">暂无目标岗位</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">
              在简历编辑页粘贴 JD 进行分析时会自动保存，或点击上方按钮手动添加。
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {records.map((record, index) => (
              <Card key={record.id} className="card-hover rounded-[1.8rem] border-border/70 bg-white/90">
                <CardContent className="space-y-4 p-5">
                  <div className={`flex min-h-[7rem] items-end rounded-[1.2rem] px-4 py-3 shadow-md ${index % 3 === 0 ? 'blob-lilac' : index % 3 === 1 ? 'blob-sand' : 'blob-mint'}`}>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3d342f]/55">Target</p>
                      <h3 className="mt-1 text-lg font-semibold tracking-tight text-[#221915] line-clamp-2">
                        {record.targetRole || record.targetCompany || record.title}
                      </h3>
                    </div>
                  </div>
                  <div>
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
                      {record.jobDescription}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(record.createdAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 rounded-full text-xs"
                      onClick={() => handleCreateResume(record)}
                      disabled={isCreating === record.id || poolItems.length === 0}
                    >
                      {isCreating === record.id ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          AI 正在创建...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-1 h-3 w-3" />
                          基于此岗位创建简历
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRecord(record.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
