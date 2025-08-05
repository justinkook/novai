import Link from 'next/link';
import { BookOpen, Code, Gamepad2, Brain, Database, Settings } from 'lucide-react';

const sections = [
  {
    title: 'Getting Started',
    description: 'Learn how to set up and run the NovAI RPG engine',
    icon: BookOpen,
    href: '/getting-started',
    color: 'bg-blue-500',
  },
  {
    title: 'Game Engine',
    description: 'Understand the core RPG engine architecture and mechanics',
    icon: Gamepad2,
    href: '/engine',
    color: 'bg-green-500',
  },
  {
    title: 'AI Agent',
    description: 'Explore the AI agent capabilities and configuration',
    icon: Brain,
    href: '/ai-agent',
    color: 'bg-purple-500',
  },
  {
    title: 'API Reference',
    description: 'Complete API documentation for the backend services',
    icon: Code,
    href: '/api',
    color: 'bg-orange-500',
  },
  {
    title: 'Data Sources',
    description: 'Learn about data sources and knowledge base management',
    icon: Database,
    href: '/data-sources',
    color: 'bg-red-500',
  },
  {
    title: 'Configuration',
    description: 'Configure your NovAI instance and settings',
    icon: Settings,
    href: '/configuration',
    color: 'bg-gray-500',
  },
];

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          NovAI Documentation
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Comprehensive documentation for the NovAI RPG engine, AI agent, and data sources.
          Everything you need to build and deploy AI-powered text RPGs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="group block p-6 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center mb-4">
                <div className={`p-2 rounded-lg ${section.color} text-white mr-3`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {section.title}
                </h2>
              </div>
              <p className="text-gray-600">{section.description}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-12 p-6 bg-blue-50 rounded-lg">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Quick Start
        </h2>
        <div className="space-y-3 text-gray-700">
          <p>
            <strong>1.</strong> Read the{' '}
            <Link href="/getting-started" className="text-blue-600 hover:underline">
              Getting Started guide
            </Link>{' '}
            to set up your development environment.
          </p>
          <p>
            <strong>2.</strong> Explore the{' '}
            <Link href="/engine" className="text-blue-600 hover:underline">
              Game Engine documentation
            </Link>{' '}
            to understand the core mechanics.
          </p>
          <p>
            <strong>3.</strong> Configure your{' '}
            <Link href="/ai-agent" className="text-blue-600 hover:underline">
              AI Agent
            </Link>{' '}
            for optimal performance.
          </p>
          <p>
            <strong>4.</strong> Set up your{' '}
            <Link href="/data-sources" className="text-blue-600 hover:underline">
              Data Sources
            </Link>{' '}
            to provide context for your AI agent.
          </p>
        </div>
      </div>
    </div>
  );
}
