'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle, AlertTriangle, XCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function UnsubscribeContent() {
  const params = useSearchParams();
  const status = params.get('status');
  const email  = params.get('email');

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#080f0f' }}>
      <div className="max-w-md w-full p-8 rounded-2xl border text-center" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        {status === 'ok' ? (
          <>
            <div className="mb-4 flex justify-center text-green-400"><CheckCircle className="w-12 h-12" /></div>
            <h1 className="text-2xl font-bold text-white mb-2">Unsubscribed</h1>
            <p className="text-[#6a9090] text-sm">
              <strong className="text-white">{email}</strong> has been removed from all future emails.
            </p>
          </>
        ) : status === 'invalid' ? (
          <>
            <div className="mb-4 flex justify-center text-yellow-400"><AlertTriangle className="w-12 h-12" /></div>
            <h1 className="text-2xl font-bold text-white mb-2">Invalid Link</h1>
            <p className="text-[#6a9090] text-sm">This unsubscribe link is invalid or missing an email address.</p>
          </>
        ) : (
          <>
            <div className="mb-4 flex justify-center text-red-400"><XCircle className="w-12 h-12" /></div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-[#6a9090] text-sm">We could not process your unsubscribe request. Please try again.</p>
          </>
        )}
        <Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm text-[#4ecdc4] hover:underline"><ArrowLeft className="w-4 h-4" /> Back to AutoReach</Link>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return <Suspense><UnsubscribeContent /></Suspense>;
}
