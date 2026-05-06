'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Trash2,
  Save,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Target,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  History,
  ImageIcon,
  FileText,
  Wand2,
  PenLine,
} from 'lucide-react';
import { useResumeStore, useSettingsStore, useJDHistoryStore, useExperiencePoolStore } from '@/store';
import { createLLM } from '@/lib/llm';
import { getJDAnalysisPrompt, getApplyOptimizationPrompt } from '@/lib/prompts';
import { JDImageUpload } from '@/components/resume/jd-image-upload';
import { JDHistoryPanel } from '@/components/resume/jd-history-panel';
import { PoolSelector } from '@/components/experience-pool/pool-selector';
import { PoolResolvedDisplay } from '@/components/experience-pool/pool-resolved-display';
import { v4 as uuidv4 } from 'uuid';
import type { Resume, Education, Skill, ResolvedResume, ExperiencePoolItem } from '@/types';
import { resolveResume as resolveResumeDB } from '@/lib/db';

interface JDAnalysisResult {
  matchScore: number;
  strengths: string[];
  gaps: string[];
  suggestions: Array<{
    section: string;
    current?: string;
    suggested: string;
    reason: string;
  }>;
  keywords: {
    matched: string[];
    missing: string[];
  };
}

export default function ResumeEditPage() {
  const params = useParams();
  const router = useRouter();
  const resumeId = params.id as string;

  const { getResume, saveResume } = useResumeStore();
  const { settings } = useSettingsStore();
  const [mounted, setMounted] = useState(false);
  const [resume, setResume] = useState<Resume | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    education: true,
    experience: true,
    projects: true,
    skills: true,
    analysis: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  // JD 分析相关状态
  const [targetRole, setTargetRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<JDAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [jdInputMode, setJdInputMode] = useState<'text' | 'image'>('text');
  const [showHistory, setShowHistory] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [resolvedResume, setResolvedResume] = useState<ResolvedResume | null>(null);
  const [showExpSelector, setShowExpSelector] = useState(false);
  const [showProjSelector, setShowProjSelector] = useState(false);
  const { addRecord } = useJDHistoryStore();
  const { loadItems: loadPool } = useExperiencePoolStore();

  useEffect(() => {
    const loadResume = async () => {
      const data = await getResume(resumeId);
      if (data) {
        setResume(data);
        // 如果有经历池引用，解析出来
        if (data.experienceIds?.length > 0 || data.projectIds?.length > 0) {
          const resolved = await resolveResumeDB(data);
          setResolvedResume(resolved);
        } else {
          // 旧格式兼容：内联数据
          setResolvedResume({
            ...data,
            experience: (data as unknown as Record<string, unknown>).experience as ExperiencePoolItem[] || [],
            projects: (data as unknown as Record<string, unknown>).projects as ExperiencePoolItem[] || [],
          } as unknown as ResolvedResume);
        }
      } else {
        router.push('/resume');
      }
    };
    setMounted(true);
    loadResume();
  }, [resumeId, getResume, router]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateBasicInfo = (field: string, value: string) => {
    if (!resume) return;
    setResume({
      ...resume,
      basicInfo: { ...resume.basicInfo, [field]: value },
    });
  };

  const addEducation = () => {
    if (!resume) return;
    const newEdu: Education = {
      id: uuidv4(),
      school: '',
      degree: '',
      major: '',
      startDate: '',
      endDate: '',
      highlights: [],
    };
    setResume({
      ...resume,
      education: [...resume.education, newEdu],
    });
  };

  const updateEducation = (id: string, field: string, value: string | string[]) => {
    if (!resume) return;
    setResume({
      ...resume,
      education: resume.education.map((edu) =>
        edu.id === id ? { ...edu, [field]: value } : edu
      ),
    });
  };

  const removeEducation = (id: string) => {
    if (!resume) return;
    setResume({
      ...resume,
      education: resume.education.filter((edu) => edu.id !== id),
    });
  };

  const addSkill = () => {
    if (!resume) return;
    const newSkill: Skill = {
      id: uuidv4(),
      category: '',
      items: [],
    };
    setResume({
      ...resume,
      skills: [...resume.skills, newSkill],
    });
  };

  const updateSkill = (id: string, field: string, value: string | string[]) => {
    if (!resume) return;
    setResume({
      ...resume,
      skills: resume.skills.map((skill) =>
        skill.id === id ? { ...skill, [field]: value } : skill
      ),
    });
  };

  const removeSkill = (id: string) => {
    if (!resume) return;
    setResume({
      ...resume,
      skills: resume.skills.filter((skill) => skill.id !== id),
    });
  };

  const handleSave = async () => {
    if (!resume) return;
    setIsSaving(true);
    try {
      await saveResume({
        ...resume,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyze = async () => {
    if (!resume || !settings?.apiKey || !jobDescription.trim()) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      const llm = await createLLM({
        apiUrl: settings.apiUrl,
        apiKey: settings.apiKey,
        model: settings.model,
      });

      const prompt = getJDAnalysisPrompt(resume, jobDescription, targetRole, targetCompany);
      const response = await llm.chatWithSystem(prompt, []);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析分析结果');
      }

      const result: JDAnalysisResult = JSON.parse(jsonMatch[0]);
      setAnalysisResult(result);
      setExpandedSections((prev) => ({ ...prev, analysis: true }));

      // 自动保存到 JD 历史
      addRecord({
        id: uuidv4(),
        title: jobDescription.trim().replace(/\n/g, ' ').substring(0, 50),
        targetRole: targetRole || undefined,
        targetCompany: targetCompany || undefined,
        jobDescription: jobDescription.trim(),
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisError(error instanceof Error ? error.message : '分析失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOptimize = async () => {
    if (!resume || !settings?.apiKey || !analysisResult) return;

    setIsOptimizing(true);
    setOptimizeError(null);

    try {
      const llm = await createLLM({
        apiUrl: settings.apiUrl,
        apiKey: settings.apiKey,
        model: settings.model,
      });

      // Build a full resume-like object for the LLM using resolved data
      const resumeForOptimize = {
        ...resume,
        experience: resolvedResume?.experience || [],
        projects: resolvedResume?.projects || [],
      };
      const prompt = getApplyOptimizationPrompt(resumeForOptimize as unknown as Resume, analysisResult.suggestions);
      const response = await llm.chatWithSystem(prompt, []);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析优化结果');
      }

      const optimized = JSON.parse(jsonMatch[0]);

      // Only update non-pool fields (basic info, education, skills)
      setResume({
        ...resume,
        basicInfo: { ...resume.basicInfo, ...(optimized.basicInfo || {}) },
        skills: optimized.skills || resume.skills,
        education: optimized.education || resume.education,
      });
    } catch (error) {
      console.error('Optimize error:', error);
      setOptimizeError(error instanceof Error ? error.message : '优化失败，请重试');
    } finally {
      setIsOptimizing(false);
    }
  };

  if (!mounted || !resume) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">编辑简历</h1>
          {isEditingName ? (
            <Input
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const updated = { ...resume, name: editNameValue || resume.basicInfo.name || '未命名简历', updatedAt: new Date().toISOString() };
                  setResume(updated);
                  saveResume(updated);
                  setIsEditingName(false);
                }
                if (e.key === 'Escape') setIsEditingName(false);
              }}
              onBlur={() => {
                const updated = { ...resume, name: editNameValue || resume.basicInfo.name || '未命名简历', updatedAt: new Date().toISOString() };
                setResume(updated);
                saveResume(updated);
                setIsEditingName(false);
              }}
              className="mt-1 text-sm bg-white border-0 rounded-[0.8rem] h-auto py-1 px-2 w-64"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-1.5 mt-1">
              <p className="text-sm text-muted-foreground">{resume.name || resume.basicInfo.name || '未命名简历'}</p>
              <button
                className="opacity-50 hover:opacity-100 transition-opacity"
                onClick={() => {
                  setIsEditingName(true);
                  setEditNameValue(resume.name || resume.basicInfo.name || '');
                }}
                title="点击编辑简历名称"
              >
                <PenLine className="h-3.5 w-3.5 text-[#3d342f]/50 hover:text-[#3d342f]/80" />
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/interview?resumeId=${resumeId}`)}>
            <MessageSquare className="h-4 w-4 mr-2" />
            开始面试
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      {/* 岗位分析卡片 */}
      <Card className="mb-4 rounded-[2rem] border-border/70 bg-gradient-to-br from-[#f8f1e0] to-white">
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection('analysis')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="blob-mint flex h-10 w-10 items-center justify-center rounded-[1rem]">
                <Target className="h-5 w-5 text-[#211915]" />
              </div>
              <div>
                <CardTitle className="text-lg">岗位匹配分析</CardTitle>
                <CardDescription>输入目标岗位 JD，分析能力差距并获取优化建议</CardDescription>
              </div>
            </div>
            {expandedSections.analysis ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSections.analysis && (
          <CardContent className="space-y-6">
            {/* 输入区 */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>目标公司</Label>
                <Input
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                  placeholder="如：字节跳动"
                  className="rounded-[1.2rem] bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label>目标岗位</Label>
                <Input
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="如：高级前端工程师"
                  className="rounded-[1.2rem] bg-white"
                />
              </div>
            </div>

            {/* JD 输入模式切换 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>岗位描述（JD）</Label>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-full bg-[#e8dfcb] p-0.5">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
                        jdInputMode === 'text' ? 'bg-[#171412] text-[#f7eed8]' : 'text-muted-foreground'
                      }`}
                      onClick={() => setJdInputMode('text')}
                    >
                      <FileText className="h-3 w-3" />
                      文字
                    </button>
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
                        jdInputMode === 'image' ? 'bg-[#171412] text-[#f7eed8]' : 'text-muted-foreground'
                      }`}
                      onClick={() => setJdInputMode('image')}
                    >
                      <ImageIcon className="h-3 w-3" />
                      截图
                    </button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-xs text-muted-foreground hover:text-[#171412]"
                    onClick={() => setShowHistory(true)}
                  >
                    <History className="h-3 w-3 mr-1" />
                    历史记录
                  </Button>
                </div>
              </div>

              {jdInputMode === 'text' ? (
                <Textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="粘贴目标岗位的 JD 内容..."
                  rows={6}
                  className="rounded-[1.4rem] bg-white"
                />
              ) : (
                <JDImageUpload
                  onTextExtracted={(text) => {
                    setJobDescription(text);
                    setJdInputMode('text');
                  }}
                />
              )}
            </div>

            {/* 历史记录面板 */}
            <JDHistoryPanel
              open={showHistory}
              onOpenChange={setShowHistory}
              onSelect={(jd) => {
                setJobDescription(jd.jobDescription);
                if (jd.targetRole) setTargetRole(jd.targetRole);
                if (jd.targetCompany) setTargetCompany(jd.targetCompany);
              }}
            />
            <Button
              className="w-full rounded-full"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !jobDescription.trim()}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  分析中，可能需要 30~100 秒...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  开始分析
                </>
              )}
            </Button>

            {/* 分析结果 */}
            {analysisError && (
              <div className="rounded-[1.5rem] bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                {analysisError}
              </div>
            )}

            {analysisResult && (
              <div className="space-y-6">
                {/* 匹配分数 */}
                <div className="rounded-[1.5rem] bg-white border border-border/50 p-6 text-center">
                  <div className="text-5xl font-bold text-[#171412]">{analysisResult.matchScore}</div>
                  <div className="text-sm text-muted-foreground mt-1">岗位匹配度评分</div>
                  <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#c8efd8] to-[#7fb59c] rounded-full transition-all duration-500"
                      style={{ width: `${analysisResult.matchScore}%` }}
                    />
                  </div>
                </div>

                {/* 优势与差距 */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.5rem] bg-[#f0fdf4] border border-[#86efac]/30 p-5">
                    <h4 className="font-semibold text-[#166534] flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-4 w-4" />
                      核心优势
                    </h4>
                    <ul className="space-y-2">
                      {analysisResult.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-[#15803d]">• {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-[1.5rem] bg-[#fef3c7] border border-[#fcd34d]/30 p-5">
                    <h4 className="font-semibold text-[#92400e] flex items-center gap-2 mb-3">
                      <AlertCircle className="h-4 w-4" />
                      能力差距
                    </h4>
                    <ul className="space-y-2">
                      {analysisResult.gaps.map((g, i) => (
                        <li key={i} className="text-sm text-[#b45309]">• {g}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 关键词匹配 */}
                <div className="rounded-[1.5rem] bg-white border border-border/50 p-5">
                  <h4 className="font-semibold mb-3">关键词匹配</h4>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.keywords.matched.map((k, i) => (
                      <Badge key={i} variant="secondary" className="bg-[#dcfce7] text-[#166534]">
                        {k}
                      </Badge>
                    ))}
                    {analysisResult.keywords.missing.map((k, i) => (
                      <Badge key={i} variant="secondary" className="bg-[#fef3c7] text-[#92400e]">
                        {k}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    绿色：已匹配 · 黄色：缺失关键词
                  </p>
                </div>

                {/* 优化建议 */}
                <div className="rounded-[1.5rem] bg-white border border-border/50 p-5">
                  <h4 className="font-semibold mb-3">优化建议</h4>
                  <div className="space-y-4">
                    {analysisResult.suggestions.map((s, i) => (
                      <div key={i} className="rounded-[1.2rem] bg-[#faf9f6] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{s.section}</Badge>
                        </div>
                        {s.current && (
                          <p className="text-sm text-muted-foreground mb-2 line-through">
                            当前：{s.current}
                          </p>
                        )}
                        <p className="text-sm font-medium text-[#171412] mb-1">
                          建议：{s.suggested}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          原因：{s.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 一键优化按钮 */}
                <Button
                  className="w-full rounded-full"
                  variant="secondary"
                  onClick={handleOptimize}
                  disabled={isOptimizing}
                >
                  {isOptimizing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      AI 正在应用优化建议...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      一键应用优化建议
                    </>
                  )}
                </Button>

                {optimizeError && (
                  <div className="rounded-[1.5rem] bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    {optimizeError}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* 基本信息 */}
      <Card className="mb-4">
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection('basic')}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">基本信息</CardTitle>
            {expandedSections.basic ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSections.basic && (
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                value={resume.basicInfo.name}
                onChange={(e) => updateBasicInfo('name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input
                value={resume.basicInfo.email}
                onChange={(e) => updateBasicInfo('email', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>电话</Label>
              <Input
                value={resume.basicInfo.phone}
                onChange={(e) => updateBasicInfo('phone', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>所在地</Label>
              <Input
                value={resume.basicInfo.location}
                onChange={(e) => updateBasicInfo('location', e.target.value)}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* 教育经历 */}
      <Card className="mb-4">
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection('education')}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">教育经历</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{resume.education.length}</Badge>
              {expandedSections.education ? <ChevronUp /> : <ChevronDown />}
            </div>
          </div>
        </CardHeader>
        {expandedSections.education && (
          <CardContent className="space-y-4">
            {resume.education.map((edu, idx) => (
              <div key={edu.id}>
                {idx > 0 && <Separator className="mb-4" />}
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium">教育经历 {idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEducation(edu.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>学校</Label>
                    <Input
                      value={edu.school}
                      onChange={(e) => updateEducation(edu.id, 'school', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>学位</Label>
                    <Input
                      value={edu.degree}
                      onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>专业</Label>
                    <Input
                      value={edu.major}
                      onChange={(e) => updateEducation(edu.id, 'major', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>开始时间</Label>
                      <Input
                        value={edu.startDate}
                        onChange={(e) => updateEducation(edu.id, 'startDate', e.target.value)}
                        placeholder="YYYY-MM"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>结束时间</Label>
                      <Input
                        value={edu.endDate}
                        onChange={(e) => updateEducation(edu.id, 'endDate', e.target.value)}
                        placeholder="YYYY-MM"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addEducation}>
              <Plus className="h-4 w-4 mr-2" />
              添加教育经历
            </Button>
          </CardContent>
        )}
      </Card>

      {/* 工作经历 */}
      <Card className="mb-4">
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection('experience')}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">工作经历</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{resolvedResume?.experience.length || 0}</Badge>
              {expandedSections.experience ? <ChevronUp /> : <ChevronDown />}
            </div>
          </div>
        </CardHeader>
        {expandedSections.experience && (
          <CardContent className="space-y-4">
            {resolvedResume && (
              <PoolResolvedDisplay type="experience" items={resolvedResume.experience} />
            )}
            <Button variant="outline" onClick={() => { loadPool(); setShowExpSelector(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              从经验池选择工作经历
            </Button>
            {resume && (
              <PoolSelector
                open={showExpSelector}
                onOpenChange={setShowExpSelector}
                type="experience"
                selectedIds={resume.experienceIds}
                onConfirm={async (ids) => {
                  const updated = { ...resume, experienceIds: ids };
                  setResume(updated);
                  const resolved = await resolveResumeDB(updated);
                  setResolvedResume(resolved);
                }}
              />
            )}
          </CardContent>
        )}
      </Card>

      {/* 项目经历 */}
      <Card className="mb-4">
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection('projects')}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">项目经历</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{resolvedResume?.projects.length || 0}</Badge>
              {expandedSections.projects ? <ChevronUp /> : <ChevronDown />}
            </div>
          </div>
        </CardHeader>
        {expandedSections.projects && (
          <CardContent className="space-y-4">
            {resolvedResume && (
              <PoolResolvedDisplay type="project" items={resolvedResume.projects} />
            )}
            <Button variant="outline" onClick={() => { loadPool(); setShowProjSelector(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              从经验池选择项目经历
            </Button>
            {resume && (
              <PoolSelector
                open={showProjSelector}
                onOpenChange={setShowProjSelector}
                type="project"
                selectedIds={resume.projectIds}
                onConfirm={async (ids) => {
                  const updated = { ...resume, projectIds: ids };
                  setResume(updated);
                  const resolved = await resolveResumeDB(updated);
                  setResolvedResume(resolved);
                }}
              />
            )}
          </CardContent>
        )}
      </Card>

      {/* 技能 */}
      <Card className="mb-4">
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection('skills')}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">技能</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{resume.skills.length}</Badge>
              {expandedSections.skills ? <ChevronUp /> : <ChevronDown />}
            </div>
          </div>
        </CardHeader>
        {expandedSections.skills && (
          <CardContent className="space-y-3">
            {resume.skills.map((skill) => (
              <div key={skill.id || skill.category} className="rounded-[1.2rem] bg-[#faf9f6] p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Input
                    value={skill.category}
                    onChange={(e) => updateSkill(skill.id, 'category', e.target.value)}
                    placeholder="技能类别，如：编程语言、框架"
                    className="flex-1 bg-white font-medium rounded-[0.8rem]"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSkill(skill.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Input
                  value={skill.items.join(', ')}
                  onChange={(e) =>
                    updateSkill(
                      skill.id,
                      'items',
                      e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                    )
                  }
                  placeholder="技能列表，逗号分隔"
                  className="bg-white rounded-[0.8rem] text-sm"
                />
              </div>
            ))}
            <Button variant="outline" onClick={addSkill}>
              <Plus className="h-4 w-4 mr-2" />
              添加技能类别
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
