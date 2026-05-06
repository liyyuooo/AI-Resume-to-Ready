'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Building2, FolderCode } from 'lucide-react';
import type { ExperiencePoolItem } from '@/types';

interface PoolItemCardProps {
  item: ExperiencePoolItem;
  onEdit: (item: ExperiencePoolItem) => void;
  onDelete: (id: string) => void;
}

export function PoolItemCard({ item, onEdit, onDelete }: PoolItemCardProps) {
  const displayName = item.type === 'experience'
    ? `${item.title || '未命名'} @ ${item.company || '未知公司'}`
    : item.name || '未命名项目';

  const subtitle = item.type === 'experience'
    ? [item.startDate, item.endDate].filter(Boolean).join(' - ')
    : item.role || '';

  const sourceLabels: Record<string, string> = {
    upload: '简历提取',
    manual: '手动输入',
    conversation: '对话记录',
  };

  return (
    <Card className="rounded-[1.2rem] border-border/50 hover:shadow-sm transition">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className={`flex h-7 w-7 items-center justify-center rounded-[0.6rem] ${
                item.type === 'experience' ? 'bg-[#eff6ff]' : 'bg-[#f0fdf4]'
              }`}>
                {item.type === 'experience' ? (
                  <Building2 className="h-3.5 w-3.5 text-[#2563eb]" />
                ) : (
                  <FolderCode className="h-3.5 w-3.5 text-[#15803d]" />
                )}
              </div>
              <Badge variant="secondary" className="text-xs">
                {item.type === 'experience' ? '工作经历' : '项目经历'}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {sourceLabels[item.source] || item.source}
              </Badge>
            </div>
            <h4 className="font-medium text-sm truncate">{displayName}</h4>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(item)}
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
