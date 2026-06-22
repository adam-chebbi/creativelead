import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | Creative Leads',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#080f0f] text-[#cde0de] py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-[#4ecdc4] hover:underline mb-8 inline-block">&larr; Back to Home</Link>
        <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>
        <div className="space-y-6 text-sm leading-relaxed" style={{ color: '#6a9090' }}>
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">1. Acceptance of Terms</h2>
          <p>By accessing and using Creative Leads, you accept and agree to be bound by the terms and provision of this agreement.</p>
          
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">2. Description of Service</h2>
          <p>Creative Leads provides a desktop application and dashboard for business lead generation. We reserve the right to modify, suspend, or discontinue the service at any time.</p>
          
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">3. User Conduct</h2>
          <p>You agree to use the service only for lawful purposes. You are strictly prohibited from using the service to scrape sensitive, protected, or illegal data.</p>
          
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">4. Privacy Policy</h2>
          <p>Your use of the service is also subject to our Privacy Policy. Please review our <Link href="/privacy" className="text-[#4ecdc4] hover:underline">Privacy Policy</Link>, which also governs the site and informs users of our data collection practices.</p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">5. Disclaimer of Warranties</h2>
          <p>The service is provided on an "as is" and "as available" basis without any warranties of any kind.</p>
        </div>
      </div>
    </div>
  );
}
