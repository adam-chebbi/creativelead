'use client';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard',          label: '📊  Overview' },
  { href: '/dashboard/leads',    label: '👥  Leads' },
  { href: '/dashboard/pipeline', label: '🔀  Pipeline' },
  { href: '/dashboard/outreach', label: '📤  Outreach' },
  { href: '/dashboard/reports',  label: '📈  Reports' },
  { href: '/dashboard/settings', label: '⚙️  Settings' },
  { href: '/download',           label: '⬇️  Download Worker' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#080f0f' }}>
      {/* Sidebar */}
      <aside className="w-56 flex flex-col shrink-0 border-r" style={{ background: '#0a1414', borderColor: '#1e3232' }}>
        {/* Logo */}
        <div className="px-5 py-6 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #4ecdc4, #e8806a)' }}>CL</div>
          <span className="font-bold text-white text-sm">
            Creative<span style={{ color: '#4ecdc4' }}>Leads</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex items-center px-3 py-2.5 rounded-lg text-sm transition-colors',
                  active ? 'text-white' : 'text-[#6a9090] hover:text-white hover:bg-[#1e3232]'
                )}
                style={active ? { background: '#1e3232', color: '#fff' } : {}}>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t" style={{ borderColor: '#1e3232' }}>
          <p className="text-xs text-[#6a9090] truncate mb-2">{session?.user?.email}</p>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className="text-xs text-[#6a9090] hover:text-red-400 transition-colors">
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
