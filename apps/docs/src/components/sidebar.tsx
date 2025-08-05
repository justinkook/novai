'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, BookOpen, Code, Gamepad2, Brain, Database, Settings, ChevronDown, ChevronRight } from 'lucide-react';

const navigation = [
  {
    title: 'Getting Started',
    href: '/getting-started',
    icon: BookOpen,
    children: [
      { title: 'Installation', href: '/getting-started/installation' },
      { title: 'Quick Start', href: '/getting-started/quick-start' },
      { title: 'Development Setup', href: '/getting-started/development' },
    ],
  },
  {
    title: 'Game Engine',
    href: '/engine',
    icon: Gamepad2,
    children: [
      { title: 'Overview', href: '/engine/overview' },
      { title: 'Game State', href: '/engine/game-state' },
      { title: 'Actions & Commands', href: '/engine/actions' },
      { title: 'Campaigns', href: '/engine/campaigns' },
      { title: 'Rulesets', href: '/engine/rulesets' },
    ],
  },
  {
    title: 'AI Agent',
    href: '/ai-agent',
    icon: Brain,
    children: [
      { title: 'Overview', href: '/ai-agent/overview' },
      { title: 'Configuration', href: '/ai-agent/configuration' },
      { title: 'Prompts', href: '/ai-agent/prompts' },
      { title: 'LLM Integration', href: '/ai-agent/llm' },
      { title: 'Memory & Context', href: '/ai-agent/memory' },
    ],
  },
  {
    title: 'API Reference',
    href: '/api',
    icon: Code,
    children: [
      { title: 'Authentication', href: '/api/auth' },
      { title: 'Game Engine API', href: '/api/game-engine' },
      { title: 'AI Agent API', href: '/api/ai-agent' },
      { title: 'Data Sources API', href: '/api/data-sources' },
    ],
  },
  {
    title: 'Data Sources',
    href: '/data-sources',
    icon: Database,
    children: [
      { title: 'Overview', href: '/data-sources/overview' },
      { title: 'Knowledge Base', href: '/data-sources/knowledge-base' },
      { title: 'Vector Search', href: '/data-sources/vector-search' },
      { title: 'Document Processing', href: '/data-sources/document-processing' },
    ],
  },
  {
    title: 'Configuration',
    href: '/configuration',
    icon: Settings,
    children: [
      { title: 'Environment Variables', href: '/configuration/env' },
      { title: 'Database Setup', href: '/configuration/database' },
      { title: 'AI Provider Setup', href: '/configuration/ai-providers' },
      { title: 'Deployment', href: '/configuration/deployment' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>(['Getting Started']);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSection = (title: string) => {
    setExpandedSections(prev =>
      prev.includes(title)
        ? prev.filter(section => section !== title)
        : [...prev, title]
    );
  };

  const filteredNavigation = navigation.filter(section =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.children?.some(child =>
      child.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">NovAI Docs</span>
        </Link>
      </div>

      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-2">
          {filteredNavigation.map((section) => {
            const Icon = section.icon;
            const isExpanded = expandedSections.includes(section.title);
            const isActive = pathname === section.href || pathname.startsWith(section.href + '/');

            return (
              <li key={section.title}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-900'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{section.title}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                {isExpanded && section.children && (
                  <ul className="ml-6 mt-2 space-y-1">
                    {section.children.map((child) => {
                      const isChildActive = pathname === child.href;
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={`block px-3 py-2 text-sm rounded-lg transition-colors ${
                              isChildActive
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {child.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
} 