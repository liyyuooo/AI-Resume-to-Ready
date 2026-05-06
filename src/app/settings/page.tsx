'use client';

import dynamic from 'next/dynamic';
import { Settings } from 'lucide-react';

const SettingsContent = dynamic(() => import('./content'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center text-muted-foreground">
        <Settings className="mx-auto h-10 w-10 mb-3 animate-pulse" />
        <p>加载中...</p>
      </div>
    </div>
  ),
});

export default function SettingsPage() {
  return <SettingsContent />;
}
