'use client';

import { SignupSuccess } from '@/components/auth/signup/success';
import { UserProvider } from '@/contexts/UserContext';

export default function Page() {
  return (
    <UserProvider>
      <SignupSuccess />
    </UserProvider>
  );
}
