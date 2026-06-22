'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" width="1em" height="1em"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
);

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const isDesktop = searchParams.get('source') === 'desktop';
  const deviceId  = searchParams.get('device_id');
  const callbackUrl = isDesktop && deviceId ? `/desktop-auth?device_id=${deviceId}` : '/dashboard';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) { setError('Invalid email or password'); return; }
    router.push(callbackUrl);
  }

  return (
    <div className="p-8 rounded-2xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
      <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
      <p className="text-sm text-[#6a9090] mb-6">Sign in to your Creative Leads account</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-[#6a9090] mb-1">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none focus:ring-1 focus:ring-[#4ecdc4]"
            style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
        </div>
        <div>
          <label className="block text-sm text-[#6a9090] mb-1">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
            className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none focus:ring-1 focus:ring-[#4ecdc4]"
            style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: '#e8806a' }}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <div className="my-6 flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: '#1e3232' }} />
        <span className="text-xs text-[#6a9090]">or continue with</span>
        <div className="flex-1 h-px" style={{ background: '#1e3232' }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => signIn('google', { callbackUrl })}
          className="py-3 flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-white border border-[#1e3232] hover:border-[#2a4444] transition-colors">
          <GoogleIcon /> Google
        </button>
        <button onClick={() => signIn('github', { callbackUrl })}
          className="py-3 flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-white border border-[#1e3232] hover:border-[#2a4444] transition-colors">
          <GitHubIcon /> GitHub
        </button>
      </div>
      <p className="text-center text-sm text-[#6a9090] mt-6">
        No account?{' '}
        <Link href="/signup" className="text-[#4ecdc4] hover:underline">Sign up free</Link>
      </p>
    </div>
  );
}
