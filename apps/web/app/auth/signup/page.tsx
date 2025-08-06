'use client';

import { Suspense } from 'react';
import { Signup } from '@/components/auth/signup/Signup';

export default function Page() {
  return (
    <main className="h-screen">
      <Suspense fallback={<div>Loading...</div>}>
        <Signup />
      </Suspense>
    </main>
  );
}
