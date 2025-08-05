import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

export default async function Page() {
  const session = await getServerSession();
  if (session) {
    return redirect('/dashboard');
  }
  redirect('/login');
}
