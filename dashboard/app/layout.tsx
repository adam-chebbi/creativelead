import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Creative Leads — Local Business Lead Generation',
  description: 'Find local business leads automatically. Your desktop worker opens Google Maps, collects businesses, and syncs everything to your dashboard in real time.',
  keywords: ['lead generation', 'local business', 'Google Maps scraper', 'cold outreach', 'sales automation'],
  authors: [{ name: 'Creative Leads' }],
  openGraph: {
    title: 'Creative Leads — Local Business Lead Generation',
    description: 'Find local business leads automatically. Watch the scraper work in real time.',
    type: 'website',
    siteName: 'Creative Leads',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
