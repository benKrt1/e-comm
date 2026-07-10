import ProtectedRoute from '@/components/layout/ProtectedRoute';

// Client-side guard for account pages. The API also requires the JWT cookie
// on every call, so this is UX (redirect) rather than the security boundary.
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
