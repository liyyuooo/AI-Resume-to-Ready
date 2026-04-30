'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Trash2, MessageSquare, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { useResumeStore } from '@/store';

export default function ResumeListPage() {
  const router = useRouter();
  const { resumes, loadResumes, deleteResume, isLoading } = useResumeStore();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadResumes();
  }, [loadResumes]);

  const handleDelete = async () => {
    if (deleteId) {
      await deleteResume(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      {/* Header */}
      <section className="paper-card px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="blob-sand h-12 w-12 rounded-full shadow-lg" />
            <div>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight">我的简历工作台</h1>
              <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                在这里维护你的简历版本，继续编辑、针对岗位优化，或者直接进入模拟面试。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="rounded-full px-5" onClick={() => router.push('/resume/new?mode=import')}>
              <Plus className="mr-2 h-4 w-4" />
              导入简历
            </Button>
            <Button
              variant="secondary"
              className="rounded-full bg-[#d7d0ff] px-5 text-[#1a1513] hover:bg-[#c7beff]"
              onClick={() => router.push('/resume/new?mode=create')}
            >
              <FileText className="mr-2 h-4 w-4" />
              AI创建
            </Button>
          </div>
        </div>
      </section>

      {/* Empty State */}
      {resumes.length === 0 ? (
        <section className="mt-8 paper-card px-6 py-12 text-center sm:px-10">
          <div className="mx-auto blob-lilac h-24 w-24 rounded-[40%_60%_55%_45%/45%_45%_55%_55%] shadow-lg" />
          <h2 className="mt-8 text-2xl font-semibold">还没有简历</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">
            先上传一份已有简历，或者让 AI 通过对话帮你从零梳理一份新的版本。
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button className="rounded-full px-5" onClick={() => router.push('/resume/new?mode=import')}>
              导入简历
            </Button>
            <Button variant="outline" className="rounded-full px-5" onClick={() => router.push('/resume/new?mode=create')}>
              AI创建
            </Button>
          </div>
        </section>
      ) : (
        /* Resume Cards */
        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {resumes.map((resume, index) => (
            <Card key={resume.id} className="card-hover overflow-hidden rounded-[1.9rem] border-border/70 bg-white/90">
              <CardContent className="space-y-5 p-5">
                {/* Decorative Header */}
                <div className={`flex min-h-[7rem] items-end rounded-[1.5rem] px-5 py-4 shadow-md ${index % 3 === 0 ? 'blob-lilac' : index % 3 === 1 ? 'blob-sand' : 'blob-mint'}`}>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#3d342f]/55">Resume</p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-[#221915]">
                      {resume.experience[0]?.title || resume.basicInfo.name || '未命名简历'}
                    </h3>
                  </div>
                </div>

                {/* Info */}
                <div>
                  <h2 className="text-xl font-semibold">{resume.basicInfo.name || '未命名简历'}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {resume.experience.length > 0
                      ? `${resume.experience[0].title} @ ${resume.experience[0].company}`
                      : '暂无工作经历'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    更新于 {new Date(resume.updatedAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button className="flex-1 rounded-full" onClick={() => router.push(`/resume/${resume.id}`)}>
                    编辑
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-full"
                    onClick={() => router.push(`/interview?resumeId=${resume.id}`)}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    面试
                  </Button>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border/70 pt-4">
                  <button
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#221915] transition hover:gap-3"
                    onClick={() => router.push(`/resume/${resume.id}`)}
                  >
                    打开详情
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(resume.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="rounded-[1.5rem]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>删除简历</DialogTitle>
            <DialogDescription>
              确定要删除这份简历吗？此操作无法撤销。
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
