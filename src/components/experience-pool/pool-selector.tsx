'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, Plus, X, GripVertical, Building2, FolderCode } from 'lucide-react';
import { useExperiencePoolStore } from '@/store';
import type { ExperiencePoolItem, PoolItemType } from '@/types';

interface PoolSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: PoolItemType;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
}

export function PoolSelector({ open, onOpenChange, type, selectedIds, onConfirm }: PoolSelectorProps) {
  const { items, loadItems } = useExperiencePoolStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([...selectedIds]);

  useEffect(() => {
    if (open) {
      loadItems();
      setSelected([...selectedIds]);
    }
  }, [open, loadItems, selectedIds]);

  const poolItems = useMemo(() =>
    items.filter((i) => i.type === type),
    [items, type]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return poolItems;
    const q = search.toLowerCase();
    return poolItems.filter((i) => {
      const searchable = [
        i.company, i.title, i.name, i.role, i.description,
      ].filter(Boolean).join(' ');
      return searchable.toLowerCase().includes(q);
    });
  }, [poolItems, search]);

  const selectedItems = useMemo(() =>
    selected.map((id) => items.find((i) => i.id === id)).filter(Boolean) as ExperiencePoolItem[],
    [selected, items]
  );

  const unselected = useMemo(() =>
    filtered.filter((i) => !selected.includes(i.id)),
    [filtered, selected]
  );

  const toggleItem = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    setSelected((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const newArr = [...prev];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= newArr.length) return prev;
      [newArr[idx], newArr[targetIdx]] = [newArr[targetIdx], newArr[idx]];
      return newArr;
    });
  };

  const getDisplayName = (item: ExperiencePoolItem) => {
    if (item.type === 'experience') {
      return `${item.title || '未命名'} @ ${item.company || '未知'}`;
    }
    return item.name || '未命名项目';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col rounded-[1.8rem]">
        <DialogHeader>
          <DialogTitle>
            {type === 'experience' ? '选择工作经历' : '选择项目经历'}
          </DialogTitle>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索..."
            className="pl-9 rounded-full bg-white"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          {/* Selected items */}
          {selectedItems.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-[#166534]">
                已选择 ({selectedItems.length})
              </h4>
              <div className="space-y-1">
                {selectedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-[1rem] bg-[#f0fdf4] border border-[#86efac]/30 p-2"
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-[#171412]"
                      onClick={() => moveItem(item.id, 'up')}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <span className="flex-1 text-sm">{getDisplayName(item)}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => toggleItem(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Separator className="mt-2" />
            </div>
          )}

          {/* Available items */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">
              可选经历 ({unselected.length})
            </h4>
            {unselected.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {search ? '没有匹配的经历' : '经历池中没有更多可选经历'}
              </p>
            )}
            <div className="space-y-1">
              {unselected.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-[1rem] border border-border/50 bg-white p-2 cursor-pointer hover:bg-[#faf9f6] transition"
                  onClick={() => toggleItem(item.id)}
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-[0.5rem] shrink-0 ${
                    item.type === 'experience' ? 'bg-[#eff6ff]' : 'bg-[#f0fdf4]'
                  }`}>
                    {item.type === 'experience' ? (
                      <Building2 className="h-3.5 w-3.5 text-[#2563eb]" />
                    ) : (
                      <FolderCode className="h-3.5 w-3.5 text-[#15803d]" />
                    )}
                  </div>
                  <span className="flex-1 text-sm">{getDisplayName(item)}</span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border/50">
                    <Plus className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border/30">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            取消
          </Button>
          <Button onClick={() => onConfirm(selected)} className="rounded-full">
            确认选择
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
