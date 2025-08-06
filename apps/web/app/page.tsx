import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { Button } from '@workspace/ui/components/button';
import { ArrowRight, Sparkles, Users, Shield, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'NovAI - AI-Powered RPG Engine',
  description: 'An AI-powered RPG engine that creates immersive tabletop gaming experiences with intelligent NPCs, dynamic storytelling, and adaptive gameplay.',
  keywords: ['RPG', 'AI', 'gaming', 'tabletop', 'D&D', 'roleplay', 'artificial intelligence'],
  authors: [{ name: 'NovAI Team' }],
  creator: 'NovAI',
  publisher: 'NovAI',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://novai.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'NovAI - AI-Powered RPG Engine',
    description: 'An AI-powered RPG engine that creates immersive tabletop gaming experiences with intelligent NPCs, dynamic storytelling, and adaptive gameplay.',
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
    description: 'An AI-powered RPG engine that creates immersive tabletop gaming experiences with intelligent NPCs, dynamic storytelling, and adaptive gameplay.',
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

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="relative z-10">
        <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8">
          <div className="flex lg:flex-1">
            <a href="/" className="-m-1.5 p-1.5">
              <span className="text-2xl font-bold text-white">NovAI</span>
            </a>
          </div>
          <div className="flex gap-x-4">
            <a href="/login" className="text-sm font-semibold leading-6 text-white">
              Log in
            </a>
            <a href="/register" className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-100">
              Sign up
            </a>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative isolate">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="flex items-center justify-center gap-x-2 mb-8">
              <Sparkles className="h-6 w-6 text-purple-400" />
              <span className="text-sm font-semibold leading-6 text-purple-400">
                AI-Powered RPG Engine
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Transform Your
              <span className="text-purple-400"> Tabletop</span>
              <br />
              Gaming Experience
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Create immersive RPG campaigns with intelligent NPCs, dynamic storytelling, and adaptive gameplay powered by cutting-edge AI technology.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <a href="#features" className="text-sm font-semibold leading-6 text-white">
                Learn more <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-purple-400">Advanced Features</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Everything you need for epic adventures
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              From intelligent NPCs to dynamic world-building, NovAI provides all the tools you need to create unforgettable RPG experiences.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                  <Zap className="h-5 w-5 flex-none text-purple-400" />
                  AI-Powered NPCs
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-300">
                  <p className="flex-auto">
                    Intelligent NPCs that adapt to your players' actions and create dynamic, engaging interactions that feel truly alive.
                  </p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                  <Users className="h-5 w-5 flex-none text-purple-400" />
                  Collaborative Storytelling
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-300">
                  <p className="flex-auto">
                    Work together with AI to create rich, branching narratives that respond to your players' choices and actions.
                  </p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                  <Shield className="h-5 w-5 flex-none text-purple-400" />
                  Secure & Private
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-300">
                  <p className="flex-auto">
                    Your campaigns and data are protected with enterprise-grade security and privacy controls.
                  </p>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to start your adventure?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-300">
              Join thousands of game masters who are already using NovAI to create unforgettable RPG experiences.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
          <div className="flex justify-center space-x-6 md:order-2">
            <a href="https://twitter.com/novai" className="text-gray-400 hover:text-gray-300">
              <span className="sr-only">Twitter</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
              </svg>
            </a>
            <a href="https://github.com/novai" className="text-gray-400 hover:text-gray-300">
              <span className="sr-only">GitHub</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
          <div className="mt-8 md:order-1 md:mt-0">
            <p className="text-center text-xs leading-5 text-gray-400">
              &copy; 2024 NovAI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
