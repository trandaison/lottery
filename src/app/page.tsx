import { redirect } from 'next/navigation';

/**
 * Landing page - redirect to admin login per Phase 11.
 */
export default function Home() {
  redirect('/admin/login');
}
