export default function ForbiddenPage() {
  return (
    <div className="flex h-screen items-center justify-center" style={{ background: '#080f0f' }}>
      <div className="text-center">
        <p className="text-6xl font-bold mb-4" style={{ color: '#e8806a' }}>403</p>
        <h1 className="text-xl font-semibold text-white mb-2">Access Denied</h1>
        <p className="text-sm mb-6" style={{ color: '#6a9090' }}>
          You don&apos;t have permission to view this page.
        </p>
        <a href="/dashboard" className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: '#1e3232' }}>
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}
