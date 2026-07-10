import AdminRoute from '@/components/layout/AdminRoute';

// Client-side staff guard. The API re-enforces the admin role on every
// /admin call (server middleware), so this is UX rather than security.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminRoute>{children}</AdminRoute>;
}
