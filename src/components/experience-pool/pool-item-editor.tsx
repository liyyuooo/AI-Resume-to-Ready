'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mic, MicOff } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useSpeechRecognition } from '@/lib/hooks/use-speech-recognition';
import type { ExperiencePoolItem, PoolItemType } from '@/types';

interface PoolItemEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: ExperiencePoolItem) => void;
  item?: ExperiencePoolItem | null;
}

function emptyItem(type: PoolItemType): ExperiencePoolItem {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    type,
    company: '',
    title: '',
    startDate: '',
    endDate: '',
    location: '',
    responsibilities: [],
    achievements: [],
    name: '',
    role: '',
    description: '',
    technologies: [],
    highlights: [],
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  };
}

export function PoolItemEditor({ open, onOpenChange, onSave, item }: PoolItemEditorProps) {
  const [type, setType] = useState<PoolItemType>(item?.type || 'experience');
  const [form, setForm] = useState<ExperiencePoolItem>(item || emptyItem('experience'));
  const [voiceDraft, setVoiceDraft] = useState('');
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);

  const mounted = useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => true,
    () => false,
  );

  const {
    isListening,
    isSupported: speechSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    language: 'zh-CN',
    continuous: true,
    onInterimResult: (text) => {
      setVoiceDraft(text);
    },
    onResult: (text) => {
      setVoiceDraft('');
      if (activeVoiceField) {
        setForm((prev) => {
          const current = (prev as unknown as Record<string, unknown>)[activeVoiceField];
          const currentStr = Array.isArray(current) ? current.join('\n') : '';
          const newValue = `${currentStr}${currentStr ? '\n' : ''}${text.trim()}`;
          return {
            ...prev,
            [activeVoiceField]: newValue.split('\n').filter(Boolean),
          };
        });
      }
    },
    onError: (error) => {
      console.error('Speech recognition error:', error);
      setVoiceDraft('');
    },
  });

  useEffect(() => {
    if (open) {
      if (item) {
        setType(item.type);
        setForm({ ...item });
      } else {
        setType('experience');
        setForm(emptyItem('experience'));
      }
    }
  }, [open, item]);

  const updateField = (field: string, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTypeChange = (newType: string) => {
    const t = newType as PoolItemType;
    setType(t);
    setForm((prev) => ({
      ...prev,
      type: t,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleSave = () => {
    onSave({
      ...form,
      type,
      updatedAt: new Date().toISOString(),
    });
    onOpenChange(false);
  };

  const toggleVoiceInput = (field: string) => {
    if (isListening && activeVoiceField === field) {
      stopListening();
      setActiveVoiceField(null);
    } else {
      if (isListening) stopListening();
      setActiveVoiceField(field);
      startListening();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-[1.8rem]">
        <DialogHeader>
          <DialogTitle>{item ? '编辑经历' : '添加经历'}</DialogTitle>
        </DialogHeader>

        <Tabs value={type} onValueChange={handleTypeChange} className="w-full">
          <TabsList className="grid h-10 w-full grid-cols-2 rounded-full bg-[#e8dfcb] p-0.5 mb-4">
            <TabsTrigger value="experience" className="rounded-full text-sm">
              工作经历
            </TabsTrigger>
            <TabsTrigger value="project" className="rounded-full text-sm">
              项目经历
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4">
          {type === 'experience' ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>公司</Label>
                  <Input
                    value={form.company || ''}
                    onChange={(e) => updateField('company', e.target.value)}
                    placeholder="公司名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label>职位</Label>
                  <Input
                    value={form.title || ''}
                    onChange={(e) => updateField('title', e.target.value)}
                    placeholder="职位名称"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>开始时间</Label>
                  <Input
                    value={form.startDate || ''}
                    onChange={(e) => updateField('startDate', e.target.value)}
                    placeholder="YYYY-MM"
                  />
                </div>
                <div className="space-y-2">
                  <Label>结束时间</Label>
                  <Input
                    value={form.endDate || ''}
                    onChange={(e) => updateField('endDate', e.target.value)}
                    placeholder="YYYY-MM 或 至今"
                  />
                </div>
                <div className="space-y-2">
                  <Label>地点</Label>
                  <Input
                    value={form.location || ''}
                    onChange={(e) => updateField('location', e.target.value)}
                    placeholder="工作地点"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>主要职责（每行一条）</Label>
                  {mounted && speechSupported && (
                    <Button
                      variant={isListening && activeVoiceField === 'responsibilities' ? 'default' : 'ghost'}
                      size="sm"
                      className={`rounded-full h-7 px-2 text-xs ${isListening && activeVoiceField === 'responsibilities' ? 'bg-red-500 hover:bg-red-600' : ''}`}
                      onClick={() => toggleVoiceInput('responsibilities')}
                    >
                      {isListening && activeVoiceField === 'responsibilities' ? (
                        <MicOff className="h-3 w-3 mr-1" />
                      ) : (
                        <Mic className="h-3 w-3 mr-1" />
                      )}
                      语音
                    </Button>
                  )}
                </div>
                <Textarea
                  value={(form.responsibilities || []).join('\n')}
                  onChange={(e) => updateField('responsibilities', e.target.value.split('\n').filter(Boolean))}
                  rows={4}
                  placeholder="bullet points 格式：总结词：1-2句话描述"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>主要成就（每行一条）</Label>
                  {mounted && speechSupported && (
                    <Button
                      variant={isListening && activeVoiceField === 'achievements' ? 'default' : 'ghost'}
                      size="sm"
                      className={`rounded-full h-7 px-2 text-xs ${isListening && activeVoiceField === 'achievements' ? 'bg-red-500 hover:bg-red-600' : ''}`}
                      onClick={() => toggleVoiceInput('achievements')}
                    >
                      {isListening && activeVoiceField === 'achievements' ? (
                        <MicOff className="h-3 w-3 mr-1" />
                      ) : (
                        <Mic className="h-3 w-3 mr-1" />
                      )}
                      语音
                    </Button>
                  )}
                </div>
                <Textarea
                  value={(form.achievements || []).join('\n')}
                  onChange={(e) => updateField('achievements', e.target.value.split('\n').filter(Boolean))}
                  rows={4}
                  placeholder="bullet points 格式：总结词：1-2句话描述"
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>项目名称</Label>
                  <Input
                    value={form.name || ''}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="项目名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label>角色</Label>
                  <Input
                    value={form.role || ''}
                    onChange={(e) => updateField('role', e.target.value)}
                    placeholder="你的角色"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>项目描述</Label>
                <Textarea
                  value={form.description || ''}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>技术栈（逗号分隔）</Label>
                <Input
                  value={(form.technologies || []).join(', ')}
                  onChange={(e) =>
                    updateField('technologies', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>主要亮点（每行一条）</Label>
                  {mounted && speechSupported && (
                    <Button
                      variant={isListening && activeVoiceField === 'highlights' ? 'default' : 'ghost'}
                      size="sm"
                      className={`rounded-full h-7 px-2 text-xs ${isListening && activeVoiceField === 'highlights' ? 'bg-red-500 hover:bg-red-600' : ''}`}
                      onClick={() => toggleVoiceInput('highlights')}
                    >
                      {isListening && activeVoiceField === 'highlights' ? (
                        <MicOff className="h-3 w-3 mr-1" />
                      ) : (
                        <Mic className="h-3 w-3 mr-1" />
                      )}
                      语音
                    </Button>
                  )}
                </div>
                <Textarea
                  value={(form.highlights || []).join('\n')}
                  onChange={(e) => updateField('highlights', e.target.value.split('\n').filter(Boolean))}
                  rows={4}
                  placeholder="bullet points 格式：总结词：1-2句话描述"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            取消
          </Button>
          <Button onClick={handleSave} className="rounded-full">
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
