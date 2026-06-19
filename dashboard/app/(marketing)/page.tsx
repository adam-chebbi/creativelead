import Link from 'next/link';

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6 border" style={{ background: 'rgba(78,205,196,0.1)', borderColor: 'rgba(78,205,196,0.3)', color: '#4ecdc4' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ecdc4] animate-pulse" />
          Now in V2 — Distributed scraping architecture
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
          Find leads.<br />
          <span style={{ color: '#4ecdc4' }}>Watch it happen.</span><br />
          Close deals.
        </h1>
        <p className="text-xl text-[#6a9090] mb-10 max-w-2xl mx-auto">
          AutoReach installs a small worker on your machine. It opens Google Maps, searches for businesses, scrolls through results, and syncs everything to your dashboard — while you watch.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/signup" className="px-8 py-4 rounded-xl font-semibold text-white text-lg transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #e8806a, #c4614a)' }}>
            Download the Worker — it&apos;s free
          </Link>
          <Link href="/auth/login" className="px-8 py-4 rounded-xl font-semibold text-[#4ecdc4] text-lg border border-[#4ecdc4]/30 hover:border-[#4ecdc4]/60 transition-all">
            View Dashboard
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: '&#128269;', title: 'Zero API costs', desc: 'Your machine navigates Google Maps directly. No paid APIs. No proxies. No per-lead charges — ever.' },
            { icon: '&#128065;', title: 'Watch it work live', desc: 'A real browser window opens on your screen. Watch the scraper type, scroll, and collect leads in real time.' },
            { icon: '&#128140;', title: 'AI outreach built in', desc: 'Groq-powered personalised emails for every lead. Automated follow-ups at day 3, 7, and 14. English, Greek, Arabic.' },
          ].map((f) => (
            <div key={f.title} className="p-6 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
              <div className="text-3xl mb-4" dangerouslySetInnerHTML={{ __html: f.icon }} />
              <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-[#6a9090] text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-12">How it works</h2>
        <div className="space-y-6">
          {[
            { n: '01', title: 'Create an account & download the worker', desc: 'Sign up in 30 seconds. Download the desktop worker for Windows, Mac, or Linux.' },
            { n: '02', title: 'Enter a city and business type, click Start', desc: 'Tell the worker what to look for. Coffee shops in Tunis. Dentists in Athens. Anything on Google Maps.' },
            { n: '03', title: 'Watch the browser collect leads automatically', desc: 'A real Chrome window opens. The worker navigates Google Maps, scrolls through results, and extracts every business it finds.' },
            { n: '04', title: 'Manage leads and send personalised emails', desc: 'All leads sync to your dashboard instantly. Move them through your pipeline. Launch AI-written outreach campaigns.' },
          ].map((s) => (
            <div key={s.n} className="flex gap-6 items-start p-6 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
              <span className="text-3xl font-bold shrink-0" style={{ color: '#4ecdc4' }}>{s.n}</span>
              <div>
                <h3 className="text-white font-semibold mb-1">{s.title}</h3>
                <p className="text-[#6a9090] text-sm">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-12">Simple pricing</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-8 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
            <h3 className="text-white font-bold text-xl mb-2">Free</h3>
            <p className="text-4xl font-bold text-white mb-6">$0<span className="text-lg text-[#6a9090]">/mo</span></p>
            <ul className="space-y-3 text-sm text-[#6a9090]">
              {['100 leads / month', '1 active campaign', 'Email outreach', 'Basic pipeline'].map(f => (
                <li key={f} className="flex items-center gap-2"><span style={{ color: '#4ecdc4' }}>&#10003;</span>{f}</li>
              ))}
            </ul>
            <Link href="/auth/signup" className="mt-8 block text-center py-3 rounded-lg border border-[#4ecdc4]/30 text-[#4ecdc4] hover:border-[#4ecdc4]/60 transition-all">Get started free</Link>
          </div>
          <div className="p-8 rounded-xl border relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0d1a1a, #0a1f1f)', borderColor: '#4ecdc4' }}>
            <div className="absolute top-4 right-4 px-2 py-1 rounded text-xs font-bold" style={{ background: '#4ecdc4', color: '#080f0f' }}>POPULAR</div>
            <h3 className="text-white font-bold text-xl mb-2">Pro</h3>
            <p className="text-4xl font-bold text-white mb-6">$29<span className="text-lg text-[#6a9090]">/mo</span></p>
            <ul className="space-y-3 text-sm text-[#6a9090]">
              {['Unlimited leads', 'Unlimited campaigns', 'AI personalisation (Groq)', 'Follow-up automation', 'Arabic + Greek + English', 'Priority support'].map(f => (
                <li key={f} className="flex items-center gap-2"><span style={{ color: '#4ecdc4' }}>&#10003;</span>{f}</li>
              ))}
            </ul>
            <Link href="/auth/signup" className="mt-8 block text-center py-3 rounded-lg font-semibold text-white transition-all hover:opacity-90" style={{ background: '#4ecdc4', color: '#080f0f' }}>Start Pro trial</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e3232] py-8 text-center text-sm text-[#6a9090]">
        <p>&copy; {new Date().getFullYear()} AutoReach. All rights reserved. &nbsp;&middot;&nbsp;
          <a href="#" className="hover:text-white">Terms</a> &nbsp;&middot;&nbsp;
          <a href="#" className="hover:text-white">Privacy</a> &nbsp;&middot;&nbsp;
          <a href="mailto:support@autoreach.dev" className="hover:text-white">Contact</a>
        </p>
      </footer>
    </main>
  );
}
