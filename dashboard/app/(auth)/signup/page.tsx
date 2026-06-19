'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Signup failed'); setLoading(false); return; }
    await signIn('credentials', { email, password, callbackUrl: '/download' });
  }

  return (
    <div className="p-8 rounded-2xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
      <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
      <p className="text-sm text-[#6a9090] mb-6">Free forever. No credit card required.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-[#6a9090] mb-1">Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Your name"
            className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none focus:ring-1 focus:ring-[#4ecdc4]"
            style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
        </div>
        <div>
          <label className="block text-sm text-[#6a9090] mb-1">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none focus:ring-1 focus:ring-[#4ecdc4]"
            style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
        </div>
        <div>
          <label className="block text-sm text-[#6a9090] mb-1">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            required minLength={8} placeholder="Min. 8 characters"
            className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none focus:ring-1 focus:ring-[#4ecdc4]"
            style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: '#e8806a' }}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
      <div className="my-6 flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: '#1e3232' }} />
        <span className="text-xs text-[#6a9090]">or</span>
        <div className="flex-1 h-px" style={{ background: '#1e3232' }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => signIn('google', { callbackUrl: '/download' })}
          className="py-3 rounded-lg text-sm font-medium text-white border border-[#1e3232] hover:border-[#2a4444] transition-colors">
          🌎 Google
        </button>
        <button onClick={() => signIn('github', { callbackUrl: '/download' })}
          className="py-3 rounded-lg text-sm font-medium text-white border border-[#1e3232] hover:border-[#2a4444] transition-colors">
          🐙 GitHub
        </button>
      </div>
      <p className="text-center text-sm text-[#6a9090] mt-6">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-[#4ecdc4] hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
