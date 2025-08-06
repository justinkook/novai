'use client';

import { Suspense } from 'react';
import { Login } from '@/components/auth/login/Login';

export default function Page() {
  return (
    <main className="h-screen">
      <Suspense fallback={<div>Loading...</div>}>
        <Login />
      </Suspense>
    </main>
  );
}
