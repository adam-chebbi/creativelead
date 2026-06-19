import Link from 'next/link';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: '#080f0f' }}>
      <nav className="border-b border-[#1e3232] px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: 'linear-gradient(135deg, #4ecdc4, #e8806a)' }}>CL</div>
          <span className="font-bold text-white">Creative<span style={{ color: '#4ecdc4' }}>Leads</span></span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-sm text-[#6a9090] hover:text-white transition-colors">Login</Link>
          <Link href="/auth/signup" className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors" style={{ background: '#e8806a' }}>Get Started Free</Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
