'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Target, MessageSquare, Brain, Code, FileText, ArrowRight, History, Clock, Trash2, List, PenLine } from 'lucide-react';
import { useResumeStore, useInterviewStore, useJDHistoryStore } from '@/store';
import type { InterviewType } from '@/types';

const interviewTypes = [
  {
    id: 'job-targeted',
    name: '岗位针对性问答',
    icon: Target,
    description: '根据目标岗位生成针对性面试问题',
    tone: 'blob-lilac',
  },
  {
    id: 'resume-deep',
    name: '简历深度追问',
    icon: FileText,
    description: '基于简历内容进行深入追问',
    tone: 'blob-sand',
  },
  {
    id: 'behavioral',
    name: '行为面试题库',
    icon: Brain,
    description: 'STAR法则行为面试问题练习',
    tone: 'blob-mint',
  },
  {
    id: 'technical',
    name: '技术面试题',
    icon: Code,
    description: '算法、系统设计等技术问题',
    tone: 'blob-lilac',
  },
];

const interviewTypeLabels: Record<string, string> = {
  'job-targeted': '岗位针对性问答',
  'resume-deep': '简历深度追问',
  behavioral: '行为面试题库',
  technical: '技术面试题',
};

function InterviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedResumeId = searchParams.get('resumeId');

  const { resumes, loadResumes } = useResumeStore();
  const { sessions, loadSessions, deleteSession, saveSession } = useInterviewStore();
  const { records: jdRecords, loadHistory } = useJDHistoryStore();

  const [mounted, setMounted] = useState(false);
  const [selectedResume, setSelectedResume] = useState(selectedResumeId || '');
  const [interviewType, setInterviewType] = useState<InterviewType>('job-targeted');
  const [targetCompany, setTargetCompany] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');

  useEffect(() => {
    setMounted(true);
    loadResumes();
    loadSessions();
    loadHistory();
  }, [loadResumes, loadSessions, loadHistory]);

  const handleDelete = async () => {
    if (deleteId) {
      await deleteSession(deleteId);
      setDeleteId(null);
    }
  };

  if (!mounted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  const handleStart = () => {
    const params = new URLSearchParams({
      resumeId: selectedResume,
      type: interviewType,
    });

    if (targetCompany) params.set('company', targetCompany);
    if (targetRole) params.set('role', targetRole);

    // JD 通过 sessionStorage 传递，避免 URL 过长导致 431 错误
    if (jobDescription) {
      sessionStorage.setItem('interview-jd', jobDescription);
    } else {
      sessionStorage.removeItem('interview-jd');
    }

    router.push(`/interview/session?${params.toString()}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      {/* Header */}
      <section className="paper-card px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="blob-mint h-12 w-12 rounded-full" />
            <div>
              <h1 className="text-4xl leading-tight">面试模拟训练</h1>
              <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                选择简历和面试类型，让 AI 扮演面试官，进行多轮实战练习。
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* 选择简历 */}
        <Card className="rounded-[2rem] border-border/70 bg-white/90 shadow-none">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="blob-sand flex h-10 w-10 items-center justify-center rounded-[1rem]">
                <FileText className="h-5 w-5 text-[#211915]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">选择简历</h3>
                <p className="text-sm text-muted-foreground">作为面试基础</p>
              </div>
            </div>

            <Select value={selectedResume} onValueChange={(v) => v && setSelectedResume(v)}>
              <SelectTrigger className="rounded-[1.2rem] bg-[#fffaf0]">
                <SelectValue placeholder="选择一份简历" />
              </SelectTrigger>
              <SelectContent>
                {resumes.map((resume) => (
                  <SelectItem key={resume.id} value={resume.id}>
                    {resume.basicInfo.name || '未命名简历'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {resumes.length === 0 && (
              <div className="mt-4 rounded-[1.2rem] bg-[#f7efde] px-4 py-3 text-sm text-muted-foreground">
                还没有简历，
                <Button variant="link" className="px-1 text-[#1a1513]" onClick={() => router.push('/resume/new')}>
                  创建一份
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 选择面试类型 */}
        <Card className="rounded-[2rem] border-border/70 bg-white/90 shadow-none">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="blob-lilac flex h-10 w-10 items-center justify-center rounded-[1rem]">
                <MessageSquare className="h-5 w-5 text-[#211915]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">面试类型</h3>
                <p className="text-sm text-muted-foreground">选择练习场景</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {interviewTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = interviewType === type.id;
                return (
                  <button
                    key={type.id}
                    className={`rounded-[1.5rem] border-2 p-4 text-left transition ${
                      isSelected
                        ? 'border-[#171412] bg-[#f7efde]'
                        : 'border-border/50 bg-white hover:border-[#171412]/30'
                    }`}
                    onClick={() => setInterviewType(type.id as InterviewType)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`${type.tone} h-9 w-9 rounded-[0.8rem] flex items-center justify-center`}>
                        <Icon className="h-4 w-4 text-[#211915]" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{type.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 岗位信息（仅岗位针对性问答需要） */}
      {interviewType === 'job-targeted' && (
        <Card className="mt-6 rounded-[2rem] border-border/70 bg-white/90 shadow-none">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="blob-mint flex h-10 w-10 items-center justify-center rounded-[1rem]">
                <Target className="h-5 w-5 text-[#211915]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">目标岗位信息</h3>
                <p className="text-sm text-muted-foreground">AI 会据此生成更有针对性的问题</p>
              </div>
            </div>

            {/* 从目标岗位列表选择 */}
            {jdRecords.length > 0 && (
              <div className="mb-5 rounded-[1.4rem] border border-[#d8ccff]/50 bg-[#f8f4ff]/60 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <List className="h-4 w-4 text-[#3d342f]/50" />
                  <span className="text-xs font-medium text-[#3d342f]/60">从目标岗位列表选择</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {jdRecords.map((record) => (
                    <button
                      key={record.id}
                      className="rounded-full border border-[#d8ccff]/60 bg-white/80 px-3 py-1.5 text-xs text-[#3d342f] hover:bg-[#d8ccff]/30 hover:border-[#b8a8ee] transition"
                      onClick={() => {
                        if (record.targetCompany) setTargetCompany(record.targetCompany);
                        if (record.targetRole) setTargetRole(record.targetRole);
                        if (record.jobDescription) setJobDescription(record.jobDescription);
                      }}
                    >
                      {record.targetRole || record.targetCompany || record.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {jdRecords.length === 0 && (
              <div className="mb-5 rounded-[1.2rem] bg-[#f7efde] px-4 py-3 text-sm text-muted-foreground">
                还没有目标岗位，
                <Button variant="link" className="px-1 text-[#1a1513]" onClick={() => router.push('/target-jobs')}>
                  去添加
                </Button>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>目标公司</Label>
                <Input
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                  placeholder="如：字节跳动"
                  className="rounded-[1.2rem] bg-[#fffaf0]"
                />
              </div>
              <div className="space-y-2">
                <Label>目标岗位</Label>
                <Input
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="如：高级前端工程师"
                  className="rounded-[1.2rem] bg-[#fffaf0]"
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label>岗位描述（JD）</Label>
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="粘贴岗位 JD..."
                rows={5}
                className="rounded-[1.4rem] bg-[#fffaf0]"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 开始按钮 */}
      <div className="mt-8 flex justify-center">
        <Button
          className="rounded-full px-8 py-6 text-base"
          onClick={handleStart}
          disabled={!selectedResume}
        >
          <MessageSquare className="mr-2 h-5 w-5" />
          开始面试
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>

      {/* 历史面试记录 */}
      {sessions.length > 0 && (
        <section className="mt-12">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <History className="h-5 w-5" />
                面试历史记录
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">查看或继续之前的面试练习</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.slice(0, 6).map((session, index) => (
              <Card key={session.id} className="card-hover rounded-[1.6rem] border-border/70 bg-white/90">
                <CardContent className="space-y-4 p-5">
                  <div className={`flex min-h-[5rem] items-end rounded-[1.2rem] px-4 py-3 shadow-md ${index % 3 === 0 ? 'blob-mint' : index % 3 === 1 ? 'blob-lilac' : 'blob-sand'}`}>
                    <div className="w-full">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3d342f]/55">Interview</p>
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
                          className="mt-1 text-sm font-semibold bg-white/50 border-0 rounded-[0.8rem] h-auto py-1 px-2"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 mt-1">
                          <h3 className="text-base font-semibold tracking-tight text-[#221915]">
                            {session.targetRole || interviewTypeLabels[session.type] || session.type}
                          </h3>
                          <button
                            className="opacity-50 hover:opacity-100 transition-opacity shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSessionId(session.id);
                              setEditingSessionTitle(session.targetRole || interviewTypeLabels[session.type] || session.type);
                            }}
                            title="点击编辑标题"
                          >
                            <PenLine className="h-3.5 w-3.5 text-[#3d342f]/50 hover:text-[#3d342f]/80" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(session.updatedAt).toLocaleDateString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      <span className="mx-1">·</span>
                      <MessageSquare className="h-3 w-3" />
                      {session.messages.length} 条消息
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-full text-xs flex-1"
                      onClick={() => router.push(`/interview/session?resumeId=${session.resumeId}&type=${session.type}`)}
                    >
                      继续面试
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(session.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="rounded-[1.5rem]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>删除面试记录</DialogTitle>
            <DialogDescription>
              确定要删除这条面试记录吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" className="rounded-full" />}>
              取消
            </DialogClose>
            <Button variant="destructive" className="rounded-full" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          加载中...
        </div>
      }
    >
      <InterviewContent />
    </Suspense>
  );
}
