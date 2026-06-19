export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#080f0f' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ background: '#e8806a' }}>&#9993;</div>
            <span className="font-bold text-white text-xl">AUTO<span style={{ color: '#e8806a' }}>REACH</span></span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
