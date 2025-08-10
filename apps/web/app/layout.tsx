import { Geist, Geist_Mono } from 'next/font/google';

import '@workspace/ui/globals.css';

import type { Metadata } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Providers } from '@/contexts/providers';

const fontSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
});

const fontMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'NovAI - AI-Powered RPG Engine',
  description:
    'An AI-powered RPG engine that creates immersive tabletop gaming experiences with intelligent NPCs, dynamic storytelling, and adaptive gameplay.',
  manifest: '/manifest.json',
  keywords: [
    'RPG',
    'AI',
    'gaming',
    'tabletop',
    'D&D',
    'roleplay',
    'artificial intelligence',
  ],
  authors: [{ name: 'NovAI Team' }],
  creator: 'NovAI',
  publisher: 'NovAI',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || 'https://novai.com'
  ),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'NovAI - AI-Powered RPG Engine',
    description:
      'An AI-powered RPG engine that creates immersive tabletop gaming experiences with intelligent NPCs, dynamic storytelling, and adaptive gameplay.',
    url: '/',
    siteName: 'NovAI',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'NovAI - AI-Powered RPG Engine',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NovAI - AI-Powered RPG Engine',
    description:
      'An AI-powered RPG engine that creates immersive tabletop gaming experiences with intelligent NPCs, dynamic storytelling, and adaptive gameplay.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased `}
      >
        <NuqsAdapter>
          <Providers>{children}</Providers>
        </NuqsAdapter>
      </body>
    </html>
  );
}
