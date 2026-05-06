'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Loader2, AlertCircle, ImageIcon } from 'lucide-react';
import { useSettingsStore } from '@/store';
import { createLLM } from '@/lib/llm';
import { JD_IMAGE_EXTRACT_PROMPT } from '@/lib/prompts';

interface JDImageUploadProps {
  onTextExtracted: (text: string) => void;
}

export function JDImageUpload({ onTextExtracted }: JDImageUploadProps) {
  const { settings } = useSettingsStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件（PNG、JPG、WebP）');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('图片文件不能超过 20MB');
      return;
    }

    setError(null);
    setPreviewUrl(URL.createObjectURL(file));

    // Read as base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setIsExtracting(true);

      try {
        const llm = await createLLM({
          apiUrl: settings!.apiUrl,
          apiKey: settings!.apiKey,
          model: settings!.model,
        });

        const response = await llm.chatWithSystem(JD_IMAGE_EXTRACT_PROMPT, [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: base64 } },
              { type: 'text', text: '请提取图片中的 JD 内容' },
            ],
          },
        ]);

        if (response.includes('无法从图片中识别')) {
          setError('未能从图片中识别到文字内容，请尝试更清晰的截图');
        } else {
          onTextExtracted(response);
        }
      } catch (err) {
        console.error('JD image extraction error:', err);
        setError(err instanceof Error ? err.message : '文字提取失败，请手动粘贴');
      } finally {
        setIsExtracting(false);
      }
    };

    reader.onerror = () => {
      setError('文件读取失败，请重试');
    };

    reader.readAsDataURL(file);
  }, [settings, onTextExtracted]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  if (isExtracting) {
    return (
      <div className="rounded-[1.8rem] border-2 border-dashed border-border bg-[#f7efde] p-12 text-center">
        {previewUrl && (
          <img
            src={previewUrl}
            alt="预览"
            className="mx-auto mb-4 max-h-48 rounded-[1rem] object-cover"
          />
        )}
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>AI 正在识别图片中的岗位描述...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[1.8rem] border-2 border-dashed p-10 text-center transition cursor-pointer ${
        isDragging
          ? 'border-[#7fb59c] bg-[#f0fdf4]'
          : 'border-border bg-[#f7efde] hover:bg-[#f3ebd8]'
      }`}
      onClick={() => fileInputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {previewUrl ? (
        <img
          src={previewUrl}
          alt="预览"
          className="mx-auto mb-6 max-h-48 rounded-[1rem] object-cover shadow-sm"
        />
      ) : (
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.2rem] bg-white/80 shadow-sm mb-4">
          <ImageIcon className="h-8 w-8 text-[#7fb59c]" />
        </div>
      )}

      <h3 className="text-lg font-semibold text-[#171412]">
        {previewUrl ? '点击更换图片' : '上传 JD 截图'}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        支持 PNG、JPG、WebP，拖拽或点击上传
      </p>

      {error && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}
