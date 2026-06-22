import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Creative Leads — Local Business Lead Generation',
  description: 'Find local business leads automatically. Your desktop worker opens Google Maps, collects businesses, and syncs everything to your dashboard in real time.',
  keywords: ['lead generation', 'local business', 'Google Maps scraper', 'cold outreach', 'sales automation'],
  authors: [{ name: 'Creative Leads' }],
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
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
