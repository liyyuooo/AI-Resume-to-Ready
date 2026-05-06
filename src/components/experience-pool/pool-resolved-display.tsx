'use client';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { ExperiencePoolItem } from '@/types';

interface PoolResolvedDisplayProps {
  type: 'experience' | 'project';
  items: ExperiencePoolItem[];
}

export function PoolResolvedDisplay({ type, items }: PoolResolvedDisplayProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        暂无{type === 'experience' ? '工作经历' : '项目经历'}，请从经验池中选择
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={item.id}>
          {idx > 0 && <Separator className="mb-3" />}
          {type === 'experience' ? (
            <div className="rounded-[1.2rem] bg-[#faf9f6] p-4 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{item.title || '未命名职位'}</span>
                <span className="text-muted-foreground">@ {item.company || '未知'}</span>
                {item.location && (
                  <Badge variant="outline" className="text-xs">{item.location}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {[item.startDate, item.endDate].filter(Boolean).join(' - ') || '时间未填写'}
              </p>
              {(item.responsibilities?.length ?? 0) > 0 && (
                <ul className="space-y-1 mb-2">
                  {item.responsibilities?.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {r}</li>
                  ))}
                </ul>
              )}
              {(item.achievements?.length ?? 0) > 0 && (
                <ul className="space-y-1">
                  {item.achievements?.map((a, i) => (
                    <li key={i} className="text-xs font-medium">• {a}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="rounded-[1.2rem] bg-[#faf9f6] p-4 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{item.name || '未命名项目'}</span>
                {item.role && (
                  <Badge variant="outline" className="text-xs">{item.role}</Badge>
                )}
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground mb-2">{item.description}</p>
              )}
              {(item.technologies?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {item.technologies?.map((t, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                  ))}
                </div>
              )}
              {(item.highlights?.length ?? 0) > 0 && (
                <ul className="space-y-1">
                  {item.highlights?.map((h, i) => (
                    <li key={i} className="text-xs font-medium">• {h}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
