import Link from 'next/link';
import { Search, Eye, Mail, BarChart, Star, RefreshCcw } from 'lucide-react';
export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6 border" style={{ background: 'rgba(78,205,196,0.1)', borderColor: 'rgba(78,205,196,0.3)', color: '#4ecdc4' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ecdc4] animate-pulse" />
          Distributed scraping — your machine, your data
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
          Find leads.<br />
          <span style={{ color: '#4ecdc4' }}>Watch it happen.</span><br />
          Close deals.
        </h1>
        <p className="text-xl text-[#6a9090] mb-10 max-w-2xl mx-auto">
          Creative Leads installs a small worker on your machine. It opens Google Maps, searches for businesses,
          scrolls through results, and syncs everything to your dashboard — while you watch.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/signup"
            className="px-8 py-4 rounded-xl font-semibold text-white text-lg transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #e8806a, #c4614a)' }}>
            Download the Worker — it&apos;s free
          </Link>
          <Link href="/auth/login"
            className="px-8 py-4 rounded-xl font-semibold text-[#4ecdc4] text-lg border border-[#4ecdc4]/30 hover:border-[#4ecdc4]/60 transition-all">
            View Dashboard
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-12">Why Creative Leads?</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <Search className="w-8 h-8 text-[#4ecdc4]" />,
              title: 'Zero API costs',
              desc: 'Your machine navigates Google Maps directly. No paid APIs. No proxies. No per-lead charges — ever.',
            },
            {
              icon: <Eye className="w-8 h-8 text-[#4ecdc4]" />,
              title: 'Watch it work live',
              desc: 'A real browser window opens on your screen. Watch the scraper type, scroll, and collect leads in real time.',
            },
            {
              icon: <Mail className="w-8 h-8 text-[#4ecdc4]" />,
              title: 'AI outreach built in',
              desc: 'Groq-powered personalised emails for every lead. Automated follow-ups at day 3, 7, and 14. English, Greek, Arabic.',
            },
            {
              icon: <BarChart className="w-8 h-8 text-[#4ecdc4]" />,
              title: 'Full CRM pipeline',
              desc: 'Kanban board with drag-and-drop. Move leads from New to Contacted to Replied to Closed. Track every deal.',
            },
            {
              icon: <Star className="w-8 h-8 text-[#4ecdc4]" />,
              title: 'Reviews included',
              desc: 'Automatically scrapes the 50 most recent Google Maps reviews for every business. Understand your leads before you reach out.',
            },
            {
              icon: <RefreshCcw className="w-8 h-8 text-[#4ecdc4]" />,
              title: 'Auto follow-ups',
              desc: 'Set it and forget it. Creative Leads sends follow-up emails automatically and stops the moment a lead replies.',
            },
          ].map((f) => (
            <div key={f.title} className="p-6 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
              <div className="mb-4">{f.icon}</div>
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
            {
              n: '01',
              title: 'Create an account and download the worker',
              desc: 'Sign up in 30 seconds. Download the Creative Leads Worker for Windows, Mac, or Linux. It\'s free.',
            },
            {
              n: '02',
              title: 'Enter a city and business type, click Start',
              desc: 'Tell the worker what to look for. Coffee shops in Tunis. Dentists in Athens. Restaurants in Dubai. Anything on Google Maps.',
            },
            {
              n: '03',
              title: 'Watch your browser collect leads automatically',
              desc: 'Your own Chrome or Edge opens. The worker navigates Google Maps, scrolls through results, visits each business page, and extracts contact details and reviews.',
            },
            {
              n: '04',
              title: 'Manage leads and send personalised emails',
              desc: 'All leads sync to your dashboard instantly. Move them through your pipeline. Launch AI-written outreach campaigns in English, Greek, or Arabic.',
            },
          ].map((s) => (
            <div key={s.n} className="flex gap-6 items-start p-6 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
              <span className="text-3xl font-bold shrink-0" style={{ color: '#4ecdc4' }}>{s.n}</span>
              <div>
                <h3 className="text-white font-semibold mb-1">{s.title}</h3>
                <p className="text-[#6a9090] text-sm leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-4">Simple pricing</h2>
        <p className="text-center text-[#6a9090] mb-12">No hidden fees. No per-lead charges. Cancel anytime.</p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-8 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
            <h3 className="text-white font-bold text-xl mb-1">Free</h3>
            <p className="text-[#6a9090] text-sm mb-4">Perfect for getting started</p>
            <p className="text-4xl font-bold text-white mb-6">$0<span className="text-lg text-[#6a9090]">/mo</span></p>
            <ul className="space-y-3 text-sm text-[#6a9090] mb-8">
              {[
                '100 leads / month',
                '1 active campaign',
                'Email outreach',
                'Basic pipeline (Kanban)',
                'Reviews scraping',
                'Community support',
              ].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span style={{ color: '#4ecdc4' }}>&#10003;</span>{f}
                </li>
              ))}
            </ul>
            <Link href="/auth/signup"
              className="block text-center py-3 rounded-lg border border-[#4ecdc4]/30 text-[#4ecdc4] hover:border-[#4ecdc4]/60 transition-all">
              Get started free
            </Link>
          </div>
          <div className="p-8 rounded-xl border relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0d1a1a, #0a1f1f)', borderColor: '#4ecdc4' }}>
            <div className="absolute top-4 right-4 px-2 py-1 rounded text-xs font-bold" style={{ background: '#4ecdc4', color: '#080f0f' }}>POPULAR</div>
            <h3 className="text-white font-bold text-xl mb-1">Pro</h3>
            <p className="text-[#6a9090] text-sm mb-4">For serious outreach</p>
            <p className="text-4xl font-bold text-white mb-6">$29<span className="text-lg text-[#6a9090]">/mo</span></p>
            <ul className="space-y-3 text-sm text-[#6a9090] mb-8">
              {[
                'Unlimited leads',
                'Unlimited campaigns',
                'AI personalisation (Groq)',
                'Follow-up automation (day 3, 7, 14)',
                'Arabic + Greek + English',
                'CSV export',
                'Priority support',
              ].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span style={{ color: '#4ecdc4' }}>&#10003;</span>{f}
                </li>
              ))}
            </ul>
            <Link href="/auth/signup"
              className="block text-center py-3 rounded-lg font-semibold text-white transition-all hover:opacity-90"
              style={{ background: '#4ecdc4', color: '#080f0f' }}>
              Start Pro trial
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e3232] py-10 px-6" style={{ background: '#0a1414' }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: 'linear-gradient(135deg, #4ecdc4, #e8806a)' }}>CL</div>
            <span className="font-bold text-white">Creative<span style={{ color: '#4ecdc4' }}>Leads</span></span>
          </div>
          <p className="text-sm text-[#6a9090]">
            &copy; {new Date().getFullYear()} Creative Leads. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-[#6a9090]">
            <a href="/docs" className="hover:text-white transition-colors">Docs</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="mailto:support@creativeleads.app" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
