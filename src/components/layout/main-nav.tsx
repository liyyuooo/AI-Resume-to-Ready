'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, MessageSquare, Settings, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/resume', label: '简历', icon: FileText },
  { href: '/interview', label: '面试', icon: MessageSquare },
  { href: '/settings', label: '设置', icon: Settings },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-white/20 bg-[#14110f]/90 px-4 py-3 text-[#f7eed8] shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur md:px-6">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-[0.18em] uppercase">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/8">
            <FileText className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">Resume Lab</span>
        </Link>

        <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-white/6 p-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition md:px-4 md:text-sm',
                  isActive
                    ? 'bg-[#d9d0ff] text-[#1d1715] shadow-sm'
                    : 'text-[#f7eed8]/78 hover:bg-white/8 hover:text-[#f7eed8]'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
