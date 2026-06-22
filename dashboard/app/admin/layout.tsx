import { requireRole } from '@/lib/admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { Users, BarChart2, Flag, FileText, Shield } from 'lucide-react';

const NAV = [
  { href: '/admin',            label: 'Overview',      icon: BarChart2 },
  { href: '/admin/users',      label: 'Users',         icon: Users },
  { href: '/admin/flags',      label: 'Feature Flags', icon: Flag },
  { href: '/admin/audit',      label: 'Audit Log',     icon: FileText },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(UserRole.ADMIN);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#080f0f' }}>
      {/* Sidebar */}
      <aside className="w-56 flex flex-col shrink-0 border-r" style={{ background: '#0a1414', borderColor: '#1e3232' }}>
        {/* Logo */}
        <div className="px-5 py-6 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #e8806a, #c84b4b)' }}>
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-bold text-white text-sm">
            Admin <span style={{ color: '#e8806a' }}>Panel</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-[#6a9090] hover:text-white hover:bg-[#1e3232]">
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Back + User */}
        <div className="px-4 py-4 border-t space-y-2" style={{ borderColor: '#1e3232' }}>
          <Link href="/dashboard" className="flex items-center gap-2 text-xs text-[#6a9090] hover:text-white transition-colors">
            ← Back to Dashboard
          </Link>
          <p className="text-xs truncate" style={{ color: '#4ecdc4' }}>
            {session.user.role} · {session.user.email}
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Impersonation banner */}
        {(session as any).isImpersonating && (
          <div className="flex items-center justify-between px-6 py-2 text-sm font-medium"
            style={{ background: '#e8806a', color: '#fff' }}>
            <span>
              ⚠️ You are impersonating a user. Actions will be performed as that user.
            </span>
            <form action="/api/admin/users/impersonate/stop" method="POST">
              <button type="submit" className="underline text-white font-semibold">
                End Impersonation
              </button>
            </form>
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
