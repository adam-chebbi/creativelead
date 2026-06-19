export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#080f0f' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #4ecdc4, #e8806a)' }}>CL</div>
            <span className="font-bold text-white text-xl">
              Creative<span style={{ color: '#4ecdc4' }}>Leads</span>
            </span>
          </div>
          <p className="text-sm text-[#6a9090] mt-1">Local business lead generation</p>
        </div>
        {children}
      </div>
    </div>
  );
}
