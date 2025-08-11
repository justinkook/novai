'use client';

import { Analytics } from '@vercel/analytics/next';
import { Toaster } from '@workspace/ui/components/toaster';
import { Suspense } from 'react';
import { AssistantProvider } from '@/contexts/AssistantContext';
import { GraphProvider } from '@/contexts/GraphContext';
import { ThreadProvider } from '@/contexts/ThreadProvider';
import { UserProvider } from '@/contexts/UserContext';

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <Suspense>
      <UserProvider>
        <ThreadProvider>
          <AssistantProvider>
            <GraphProvider>
              {children}
              <Toaster />
              <Analytics />
            </GraphProvider>
          </AssistantProvider>
        </ThreadProvider>
      </UserProvider>
    </Suspense>
  );
};
