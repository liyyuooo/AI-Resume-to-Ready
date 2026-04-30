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
} from 'lucide-react';
import { useResumeStore, useSettingsStore } from '@/store';
import { createLLM } from '@/lib/llm';
import { getJDAnalysisPrompt } from '@/lib/prompts';
import { v4 as uuidv4 } from 'uuid';
import type { Resume, Experience, Education, Project, Skill } from '@/types';

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

  const { getResume, saveResume, isLoading } = useResumeStore();
  const { settings } = useSettingsStore();
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

  // JD 分析相关状态
  const [targetRole, setTargetRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<JDAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    const loadResume = async () => {
      const data = await getResume(resumeId);
      if (data) {
        setResume(data);
      } else {
        router.push('/resume');
      }
    };
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

  const addExperience = () => {
    if (!resume) return;
    const newExp: Experience = {
      id: uuidv4(),
      company: '',
      title: '',
      startDate: '',
      endDate: '',
      location: '',
      responsibilities: [],
      achievements: [],
    };
    setResume({
      ...resume,
      experience: [...resume.experience, newExp],
    });
  };

  const updateExperience = (id: string, field: string, value: string | string[]) => {
    if (!resume) return;
    setResume({
      ...resume,
      experience: resume.experience.map((exp) =>
        exp.id === id ? { ...exp, [field]: value } : exp
      ),
    });
  };

  const removeExperience = (id: string) => {
    if (!resume) return;
    setResume({
      ...resume,
      experience: resume.experience.filter((exp) => exp.id !== id),
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

  const addProject = () => {
    if (!resume) return;
    const newProj: Project = {
      id: uuidv4(),
      name: '',
      role: '',
      description: '',
      technologies: [],
      highlights: [],
    };
    setResume({
      ...resume,
      projects: [...resume.projects, newProj],
    });
  };

  const updateProject = (id: string, field: string, value: string | string[]) => {
    if (!resume) return;
    setResume({
      ...resume,
      projects: resume.projects.map((proj) =>
        proj.id === id ? { ...proj, [field]: value } : proj
      ),
    });
  };

  const removeProject = (id: string) => {
    if (!resume) return;
    setResume({
      ...resume,
      projects: resume.projects.filter((proj) => proj.id !== id),
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
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisError(error instanceof Error ? error.message : '分析失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading || !resume) {
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
          <h1 className="text-3xl font-bold">编辑简历</h1>
          <p className="text-muted-foreground">{resume.basicInfo.name || '未命名简历'}</p>
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
            <div className="space-y-2">
              <Label>岗位描述（JD）</Label>
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="粘贴目标岗位的 JD 内容..."
                rows={6}
                className="rounded-[1.4rem] bg-white"
              />
            </div>
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
              <Badge variant="secondary">{resume.experience.length}</Badge>
              {expandedSections.experience ? <ChevronUp /> : <ChevronDown />}
            </div>
          </div>
        </CardHeader>
        {expandedSections.experience && (
          <CardContent className="space-y-4">
            {resume.experience.map((exp, idx) => (
              <div key={exp.id}>
                {idx > 0 && <Separator className="mb-4" />}
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium">工作经历 {idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeExperience(exp.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>公司</Label>
                      <Input
                        value={exp.company}
                        onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>职位</Label>
                      <Input
                        value={exp.title}
                        onChange={(e) => updateExperience(exp.id, 'title', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>开始时间</Label>
                      <Input
                        value={exp.startDate}
                        onChange={(e) => updateExperience(exp.id, 'startDate', e.target.value)}
                        placeholder="YYYY-MM"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>结束时间</Label>
                      <Input
                        value={exp.endDate}
                        onChange={(e) => updateExperience(exp.id, 'endDate', e.target.value)}
                        placeholder="YYYY-MM 或 至今"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>地点</Label>
                      <Input
                        value={exp.location || ''}
                        onChange={(e) => updateExperience(exp.id, 'location', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>主要职责（每行一条）</Label>
                    <Textarea
                      value={exp.responsibilities.join('\n')}
                      onChange={(e) =>
                        updateExperience(exp.id, 'responsibilities', e.target.value.split('\n').filter(Boolean))
                      }
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>主要成就（每行一条）</Label>
                    <Textarea
                      value={exp.achievements.join('\n')}
                      onChange={(e) =>
                        updateExperience(exp.id, 'achievements', e.target.value.split('\n').filter(Boolean))
                      }
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addExperience}>
              <Plus className="h-4 w-4 mr-2" />
              添加工作经历
            </Button>
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
              <Badge variant="secondary">{resume.projects.length}</Badge>
              {expandedSections.projects ? <ChevronUp /> : <ChevronDown />}
            </div>
          </div>
        </CardHeader>
        {expandedSections.projects && (
          <CardContent className="space-y-4">
            {resume.projects.map((proj, idx) => (
              <div key={proj.id}>
                {idx > 0 && <Separator className="mb-4" />}
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium">项目 {idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProject(proj.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>项目名称</Label>
                      <Input
                        value={proj.name}
                        onChange={(e) => updateProject(proj.id, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>角色</Label>
                      <Input
                        value={proj.role}
                        onChange={(e) => updateProject(proj.id, 'role', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>项目描述</Label>
                    <Textarea
                      value={proj.description}
                      onChange={(e) => updateProject(proj.id, 'description', e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>技术栈（逗号分隔）</Label>
                    <Input
                      value={proj.technologies.join(', ')}
                      onChange={(e) =>
                        updateProject(
                          proj.id,
                          'technologies',
                          e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>主要亮点（每行一条）</Label>
                    <Textarea
                      value={proj.highlights.join('\n')}
                      onChange={(e) =>
                        updateProject(proj.id, 'highlights', e.target.value.split('\n').filter(Boolean))
                      }
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addProject}>
              <Plus className="h-4 w-4 mr-2" />
              添加项目经历
            </Button>
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
          <CardContent className="space-y-4">
            {resume.skills.map((skill) => (
              <div key={skill.id} className="flex gap-4 items-start">
                <div className="flex-1 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>技能类别</Label>
                    <Input
                      value={skill.category}
                      onChange={(e) => updateSkill(skill.id, 'category', e.target.value)}
                      placeholder="如：编程语言、框架、工具等"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>技能列表（逗号分隔）</Label>
                    <Input
                      value={skill.items.join(', ')}
                      onChange={(e) =>
                        updateSkill(
                          skill.id,
                          'items',
                          e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                        )
                      }
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-8"
                  onClick={() => removeSkill(skill.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
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
