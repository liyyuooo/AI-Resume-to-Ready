'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, FileText, Sparkles, Target, Clock, History, Users, GraduationCap, Shuffle, Settings, Layers, PenLine } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettingsStore, useResumeStore, useInterviewStore } from '@/store';

const features = [
  {
    icon: FileText,
    title: '导入与解析',
    description: '支持 PDF / Word / 文本，AI 自动抽取结构化信息并加入经验池。',
    href: '/resume/new?mode=import',
    tone: 'blob-lilac',
  },
  {
    icon: Sparkles,
    title: '对话式创建',
    description: '像顾问一样追问经历细节，帮你挖出亮点与成果。',
    href: '/resume/new?mode=create',
    tone: 'blob-sand',
  },
  {
    icon: Layers,
    title: '经历素材池',
    description: '集中管理工作和项目经历，支持语音输入补充细节，简历上传自动归集。',
    href: '/experience-pool',
    tone: 'blob-mint',
  },
  {
    icon: Target,
    title: '目标岗位 & JD 匹配',
    description: '管理目标岗位列表，一键分析 JD 差距，AI 从经历池挑选并创建定制简历。',
    href: '/target-jobs',
    tone: 'blob-lilac',
  },
  {
    icon: Users,
    title: '多类型模拟面试',
    description: '岗位问答 / 简历深问 / 行为面试 / 技术题，多轮实战。',
    href: '/interview',
    tone: 'blob-sand',
  },
];

const interviewTypeLabels: Record<string, string> = {
  'job-targeted': '岗位针对性问答',
  'resume-deep': '简历深度追问',
  behavioral: '行为面试题库',
  technical: '技术面试题',
};

export default function HomePage() {
  const router = useRouter();
  const { loadSettings } = useSettingsStore();
  const { loadResumes, resumes, saveResume } = useResumeStore();
  const { loadSessions, sessions, saveSession } = useInterviewStore();

  const [mounted, setMounted] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingCardName, setEditingCardName] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');

  useEffect(() => {
    setMounted(true);
    loadSettings();
    loadResumes();
    loadSessions();
  }, [loadSettings, loadResumes, loadSessions]);

  if (!mounted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  const recentResumes = resumes.slice(0, 3);
  const recentSessions = sessions.slice(0, 3);

  return (
    <div className="pb-20">
      {/* Section 1: Hero */}
      <section className="mx-auto mt-2 max-w-6xl px-4 sm:px-6">
        <div className="hero-wave overflow-hidden rounded-[2.5rem] px-6 pb-12 pt-14 text-[#f6edd8] sm:px-10 lg:px-14">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.25em] text-[#f6edd8]/75 backdrop-blur-sm">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#d8ccff]" />
                Resume + Interview Copilot
              </div>
              <div className="space-y-5">
                <h1 className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                  Resume
                  <br />
                  <span className="text-[#d8ccff]">to Ready</span>
                </h1>
                <p className="max-w-lg text-sm leading-7 text-[#f6edd8]/72 sm:text-base">
                  从简历到面试，AI 帮你梳理经历、优化简历、模拟面试，一条完整工作流。
                </p>
              </div>
              <div className="relative z-10 flex flex-wrap items-center gap-3">
                <button className="ink-button" onClick={() => router.push('/resume/new?mode=import')}>
                  导入已有简历
                </button>
                <Button
                  variant="secondary"
                  className="rounded-full bg-[#d7d0ff] px-5 py-3 text-[#1a1513] hover:bg-[#c7beff]"
                  onClick={() => router.push('/resume/new?mode=create')}
                >
                  AI 帮我开始
                </Button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-xs text-[#f6edd8]/60 transition hover:border-white/30 hover:text-[#f6edd8]/90"
                  onClick={() => router.push('/settings')}
                >
                  <Settings className="h-3 w-3" />
                  使用前请先配置 API Key
                </button>
              </div>
            </div>

            {/* Decorative Visual */}
            <div className="relative hidden min-h-[380px] rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-sm lg:block">
              <div className="blob-lilac float-animation absolute left-8 top-10 h-20 w-20 rounded-[50%_40%_60%_45%] opacity-90 shadow-lg" />
              <div className="blob-sand float-animation-slow absolute left-32 top-24 h-12 w-16 rotate-12 rounded-[40%_60%_50%_50%] opacity-80 shadow-md" style={{ animationDelay: '1s' }} />
              <div className="blob-mint float-animation absolute right-6 top-16 h-28 w-40 rotate-6 rounded-[45%_55%_60%_40%] opacity-75 shadow-lg" style={{ animationDelay: '2s' }} />
              <div className="blob-sand float-animation-slow absolute bottom-12 left-12 h-20 w-20 rounded-full opacity-85 shadow-md" style={{ animationDelay: '0.5s' }} />

              <div className="absolute bottom-10 right-10 max-w-xs rounded-[1.5rem] bg-[#f2e8d3]/95 p-5 text-[#1f1814] shadow-2xl backdrop-blur-sm">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#7fb59c]" />
                  <div className="text-sm font-medium">本地数据优先</div>
                </div>
                <p className="text-sm leading-6 text-[#5a4d46]">
                  API Key、简历与面试记录都保存在你的浏览器本地，适合真实使用。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: 为谁设计 */}
      <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
        <div className="paper-card px-6 py-10 sm:px-10 lg:px-12">
          <h2 className="mb-8 text-3xl font-semibold tracking-tight">为谁设计</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* 卡片 A：初次求职者 */}
            <div className="overflow-hidden rounded-[2rem] border border-[#d8ccff]/60 bg-[#f8f4ff]">
              <div className="blob-lilac px-6 py-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] bg-white/30">
                    <GraduationCap className="h-5 w-5 text-[#221915]" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#3d342f]/55">For</p>
                    <h3 className="text-xl font-semibold text-[#221915]">初次求职者</h3>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-[#4a3f38]">
                  应届生、在校生，实习或项目经历还在积累中
                </p>
              </div>
              <div className="space-y-4 px-6 py-6">
                <p className="text-sm leading-7 text-[#473a34]">
                  你可能第一次写简历，课堂项目、社团活动、比赛经历攒了不少，但不知道哪些该写、怎么写得像一份正经简历。面试官一句"说说你自己吧"，脑子就空白了。
                </p>
                <p className="text-sm leading-7 text-[#473a34]">
                  试试从 AI 对话开始 —— 它会像有经验的学长一样追问你做过的事，把零散的经历串成有亮点的简历，再陪你模拟几轮面试，真正上场就不慌了。
                </p>
              </div>
            </div>

            {/* 卡片 B：跨岗位求职者 */}
            <div className="overflow-hidden rounded-[2rem] border border-[#ffd9bc]/60 bg-[#fff8f2]">
              <div className="blob-sand px-6 py-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] bg-white/30">
                    <Shuffle className="h-5 w-5 text-[#221915]" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#3d342f]/55">For</p>
                    <h3 className="text-xl font-semibold text-[#221915]">跨岗位求职者</h3>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-[#4a3f38]">
                  想转岗、跨行业，现有经验需要重新包装
                </p>
              </div>
              <div className="space-y-4 px-6 py-6">
                <p className="text-sm leading-7 text-[#473a34]">
                  你不是没经验，而是经验都在另一个赛道。投出去的简历经常石沉大海，明明能力够强，只是没按新岗位的话语体系来讲 —— 用老赛道的词汇去匹配新 JD，自然不被搜索到。
                </p>
                <p className="text-sm leading-7 text-[#473a34]">
                  把现有简历导进来，AI 帮你对比目标 JD，找出你已经具备的可迁移能力，标记需要补的关键词，再用新岗位的语言改写一遍。面试时怎么解释转岗动机，也可以提前练好。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: 核心功能 */}
      <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
        <div className="paper-card px-6 py-10 sm:px-8 lg:px-12">
          <h2 className="mb-8 text-3xl font-semibold tracking-tight">核心功能</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.href}
                  className="card-hover h-full cursor-pointer rounded-[1.6rem] border-border/70 bg-white/90"
                  onClick={() => router.push(feature.href)}
                >
                  <CardContent className="flex h-full flex-col gap-5 p-5">
                    <div className={`h-14 w-14 rounded-[1.2rem] ${feature.tone} flex items-center justify-center shadow-md`}>
                      <Icon className="h-6 w-6 text-[#201713]" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold">{feature.title}</h3>
                      <p className="text-sm leading-6 text-muted-foreground">{feature.description}</p>
                    </div>
                    <div className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-[#1e1714]">
                      进入模块
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 4: 求职工作台 */}
      <section className="mx-auto mt-8 max-w-6xl px-4 sm:mt-10 sm:px-6">
        <div className="dashboard-shell rounded-[2.5rem] px-0 pt-0">
          <div className="soft-grid rounded-[2.3rem] border border-[#c8d8bc]/85 bg-[linear-gradient(180deg,rgba(226,238,214,0.96),rgba(214,230,201,0.92))] px-6 py-10 shadow-[0_24px_80px_rgba(92,86,54,0.10)] sm:px-10">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">求职工作台</h2>
              <p className="mt-1 text-sm text-muted-foreground">继续上次的工作，或开始新的任务。</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => router.push('/resume')}>
                  <History className="mr-2 h-4 w-4" />
                  全部简历
              </Button>
              <Button variant="outline" className="rounded-full" onClick={() => router.push('/interview')}>
                  <Clock className="mr-2 h-4 w-4" />
                  面试记录
              </Button>
            </div>
          </div>

          {recentResumes.length > 0 && (
            <div className="mb-8">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                最近简历
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                {recentResumes.map((resume, index) => (
                  <Card
                    key={resume.id}
                    className="card-hover h-full cursor-pointer rounded-[1.75rem] border border-[#d9e4d0] bg-white/96 shadow-[0_16px_40px_rgba(42,31,20,0.08)] transition-transform"
                    onClick={() => router.push(`/resume/${resume.id}`)}
                  >
                    <CardContent className="space-y-4 p-5">
                      <div className={`flex min-h-[8.5rem] items-end rounded-[1.7rem] px-6 py-5 shadow-md ${index % 2 === 0 ? 'blob-lilac' : 'blob-sand'}`}>
                        <div className="w-full">
                          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#3d342f]/55">Resume</p>
                          {editingCardId === resume.id ? (
                            <Input
                              value={editingCardName}
                              onChange={(e) => setEditingCardName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveResume({ ...resume, name: editingCardName, updatedAt: new Date().toISOString() });
                                  setEditingCardId(null);
                                }
                                if (e.key === 'Escape') setEditingCardId(null);
                              }}
                              onBlur={() => {
                                saveResume({ ...resume, name: editingCardName || resume.basicInfo.name || '未命名简历', updatedAt: new Date().toISOString() });
                                setEditingCardId(null);
                              }}
                              className="mt-1 text-xl font-semibold bg-white/50 border-0 rounded-[0.8rem] h-auto py-1 px-2"
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center gap-2 mt-2">
                              <h4 className="text-3xl font-semibold tracking-tight text-[#221915]">
                                {resume.name || resume.basicInfo.name || '未命名简历'}
                              </h4>
                              <button
                                className="opacity-50 hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCardId(resume.id);
                                  setEditingCardName(resume.name || resume.basicInfo.name || '');
                                }}
                                title="点击编辑标题"
                              >
                                <PenLine className="h-4 w-4 text-[#3d342f]/50 hover:text-[#3d342f]/80" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-[#473a34]">
                          {resume.experienceIds.length > 0 ? '有工作经历' : '暂无工作经历'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          更新于 {new Date(resume.updatedAt).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/resume/${resume.id}`);
                          }}
                        >
                          编辑简历
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-full text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/interview?resumeId=${resume.id}`);
                          }}
                        >
                          开始面试
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {recentSessions.length > 0 && (
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                最近面试
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                {recentSessions.map((session, index) => (
                  <Card
                    key={session.id}
                    className="card-hover h-full cursor-pointer rounded-[1.75rem] border border-[#d9e4d0] bg-white/96 shadow-[0_16px_40px_rgba(42,31,20,0.08)] transition-transform"
                    onClick={() => router.push(`/interview/session?resumeId=${session.resumeId}&type=${session.type}`)}
                  >
                    <CardContent className="space-y-4 p-5">
                      <div className={`flex min-h-[7.75rem] items-end rounded-[1.65rem] px-6 py-5 shadow-md ${index % 2 === 0 ? 'blob-mint' : 'blob-lilac'}`}>
                        <div className="w-full">
                          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#3d342f]/55">Interview</p>
                          {editingSessionId === session.id ? (
                            <Input
                              value={editingSessionTitle}
                              onChange={(e) => setEditingSessionTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveSession({ ...session, targetRole: editingSessionTitle, updatedAt: new Date().toISOString() });
                                  setEditingSessionId(null);
                                }
                                if (e.key === 'Escape') setEditingSessionId(null);
                              }}
                              onBlur={() => {
                                saveSession({ ...session, targetRole: editingSessionTitle || undefined, updatedAt: new Date().toISOString() });
                                setEditingSessionId(null);
                              }}
                              className="mt-1 text-xl font-semibold bg-white/50 border-0 rounded-[0.8rem] h-auto py-1 px-2"
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center gap-2 mt-2">
                              <h4 className="text-2xl font-semibold tracking-tight text-[#221915]">
                                {session.targetRole || interviewTypeLabels[session.type] || session.type}
                              </h4>
                              <button
                                className="opacity-50 hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSessionId(session.id);
                                  setEditingSessionTitle(session.targetRole || interviewTypeLabels[session.type] || session.type);
                                }}
                                title="点击编辑标题"
                              >
                                <PenLine className="h-4 w-4 text-[#3d342f]/50 hover:text-[#3d342f]/80" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-[#473a34]">
                          {session.targetRole || '未指定岗位'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {session.messages.length} 条消息 · {new Date(session.updatedAt).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {recentResumes.length === 0 && recentSessions.length === 0 && (
            <div className="rounded-[1.8rem] bg-[#f8f1e0]/95 p-8 text-center">
              <p className="text-muted-foreground">还没有简历或面试记录，开始创建吧！</p>
              <div className="mt-4 flex justify-center gap-3">
                <Button className="rounded-full" onClick={() => router.push('/resume/new?mode=import')}>
                  导入简历
                </Button>
                <Button variant="outline" className="rounded-full" onClick={() => router.push('/resume/new?mode=create')}>
                  AI 创建简历
                </Button>
              </div>
            </div>
          )}
          </div>
        </div>
      </section>

      {/* Section 5: 底部引用 */}
      <section className="mx-auto mt-8 max-w-6xl px-4 pb-4 sm:px-6">
        <div className="overflow-hidden rounded-[2.5rem] border border-white/40 bg-[linear-gradient(135deg,rgba(255,251,241,0.86),rgba(244,236,220,0.78))] px-6 py-14 shadow-[0_18px_60px_rgba(108,92,69,0.12)] backdrop-blur-sm sm:px-12">
          <div className="mx-auto max-w-3xl rounded-[1.8rem] border border-white/50 bg-white/70 p-8 text-center shadow-[0_20px_50px_rgba(89,83,56,0.12)] backdrop-blur-sm">
            <div className="mb-4 flex justify-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d59e81]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#bea6ff]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#9fd4bb]" />
            </div>
            <p className="text-2xl font-semibold leading-tight text-[#211814]">
              &ldquo;从简历到面试，一条完整工作流。&rdquo;
            </p>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">
              你可以把它当作自己的长期工具：先导入简历，再围绕 JD 做针对性优化，最后进入模拟面试闭环。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
