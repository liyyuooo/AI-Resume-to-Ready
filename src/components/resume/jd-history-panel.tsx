'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Clock, Trash2, History, AlertCircle } from 'lucide-react';
import { useJDHistoryStore } from '@/store';

interface JDHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (jd: { jobDescription: string; targetRole?: string; targetCompany?: string }) => void;
}

export function JDHistoryPanel({ open, onOpenChange, onSelect }: JDHistoryPanelProps) {
  const { records, isLoading, loadHistory, removeRecord } = useJDHistoryStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) loadHistory();
  }, [open, loadHistory]);

  const handleSelect = (record: typeof records[0]) => {
    onSelect({
      jobDescription: record.jobDescription,
      targetRole: record.targetRole,
      targetCompany: record.targetCompany,
    });
    onOpenChange(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    await removeRecord(id);
    setDeletingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto rounded-[1.8rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            历史岗位描述
          </DialogTitle>
          <DialogDescription>
            选择之前使用过的 JD 快速开始分析
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isLoading && (
            <div className="py-8 text-center text-muted-foreground">加载中...</div>
          )}

          {!isLoading && records.length === 0 && (
            <div className="py-8 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">暂无历史记录</p>
              <p className="text-xs text-muted-foreground mt-1">
                完成一次 JD 分析后会自动保存
              </p>
            </div>
          )}

          {records.map((record) => (
            <div
              key={record.id}
              className="rounded-[1.2rem] border border-border/50 bg-white p-4 cursor-pointer hover:bg-[#faf9f6] transition"
              onClick={() => handleSelect(record)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm truncate">{record.title}</h4>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {record.targetRole && <span>{record.targetRole}</span>}
                    {record.targetCompany && (
                      <>
                        <span>·</span>
                        <span>{record.targetCompany}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(record.lastUsedAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  disabled={deletingId === record.id}
                  onClick={(e) => handleDelete(e, record.id)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
