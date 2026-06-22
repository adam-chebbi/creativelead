'use client';
import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service like Sentry
    console.error('[ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#080f0f] text-white">
      <div className="max-w-md w-full p-8 rounded-2xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <h2 className="text-xl font-bold mb-4" style={{ color: '#e8806a' }}>Something went wrong!</h2>
        <p className="text-sm mb-6" style={{ color: '#6a9090' }}>
          An unexpected error occurred in the application. Our team has been notified.
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => reset()}
            className="flex-1 py-3 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: '#4ecdc4', color: '#080f0f' }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="flex-1 py-3 rounded-lg text-sm font-medium transition-colors border"
            style={{ borderColor: '#1e3232', color: '#cde0de' }}
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
