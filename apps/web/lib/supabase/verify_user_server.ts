import type { Session, User } from '@supabase/supabase-js';
import { createClient } from './server';

export async function verifyUserAuthenticated(): Promise<
  { user: User; session: Session } | undefined
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!user || !session) {
    return undefined;
  }
  return { user, session };
}
