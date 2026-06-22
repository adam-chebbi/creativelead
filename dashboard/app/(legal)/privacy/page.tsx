import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Creative Leads',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#080f0f] text-[#cde0de] py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-[#4ecdc4] hover:underline mb-8 inline-block">&larr; Back to Home</Link>
        <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>
        <div className="space-y-6 text-sm leading-relaxed" style={{ color: '#6a9090' }}>
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">1. Information We Collect</h2>
          <p>We collect information you provide directly to us, such as when you create or modify your account, or contact customer support. This includes your email address, name, and the data scraped by your worker.</p>
          
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">2. How We Use Information</h2>
          <p>We use the information we collect to provide, maintain, and improve our services, as well as to communicate with you about your account.</p>
          
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">3. Data Retention and Deletion</h2>
          <p>We store your data securely. You have the right to request deletion of your account and all associated data at any time from your account settings.</p>
          
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">4. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at support@creativeleads.com.</p>
        </div>
      </div>
    </div>
  );
}
