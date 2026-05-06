'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Layers, AlertCircle } from 'lucide-react';
import { useExperiencePoolStore } from '@/store';
import { PoolItemCard } from '@/components/experience-pool/pool-item-card';
import { PoolItemEditor } from '@/components/experience-pool/pool-item-editor';
import type { ExperiencePoolItem } from '@/types';

export default function ExperiencePoolContent() {
  const { items, isLoading, loadItems, addItem, updateItem, deleteItem } = useExperiencePoolStore();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('experience');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExperiencePoolItem | null>(null);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filtered = useMemo(() => {
    let list = items.filter((i) => i.type === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => {
        const searchable = [i.company, i.title, i.name, i.role, i.description]
          .filter(Boolean).join(' ');
        return searchable.toLowerCase().includes(q);
      });
    }
    return list;
  }, [items, activeTab, search]);

  const handleEdit = (item: ExperiencePoolItem) => {
    setEditingItem(item);
    setEditorOpen(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setEditorOpen(true);
  };

  const handleSave = async (item: ExperiencePoolItem) => {
    if (editingItem) {
      await updateItem(item);
    } else {
      await addItem(item);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定删除这条经历吗？删除后使用该经历的简历将不再显示它。')) {
      await deleteItem(id);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] bg-[#f0fdf4]">
              <Layers className="h-5 w-5 text-[#166534]" />
            </div>
            <h1 className="text-3xl font-bold">经验素材池</h1>
          </div>
          <p className="text-muted-foreground">管理你所有的实习、工作和项目经历，在编辑简历时从池中选择</p>
          <p className="text-xs text-amber-600 mt-2">
            提示：上传简历时，AI 解析出的经历会自动加入经验池，无需手动逐条添加。
          </p>
        </div>
        <Button onClick={handleAdd} className="rounded-full">
          <Plus className="h-4 w-4 mr-2" />
          添加经历
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索经历..."
          className="pl-9 rounded-full bg-white"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid h-10 w-64 grid-cols-2 rounded-full bg-[#e8dfcb] p-0.5 mb-6">
          <TabsTrigger value="experience" className="rounded-full text-sm">
            工作经历 ({items.filter((i) => i.type === 'experience').length})
          </TabsTrigger>
          <TabsTrigger value="project" className="rounded-full text-sm">
            项目经历 ({items.filter((i) => i.type === 'project').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="experience" className="mt-0">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {search ? '没有匹配的工作经历' : '暂无工作经历'}
              </p>
              <Button variant="outline" className="mt-3 rounded-full" onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                添加第一条工作经历
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((item) => (
                <PoolItemCard
                  key={item.id}
                  item={item}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="project" className="mt-0">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {search ? '没有匹配的项目经历' : '暂无项目经历'}
              </p>
              <Button variant="outline" className="mt-3 rounded-full" onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                添加第一个项目经历
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((item) => (
                <PoolItemCard
                  key={item.id}
                  item={item}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PoolItemEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSave={handleSave}
        item={editingItem}
      />
    </div>
  );
}
