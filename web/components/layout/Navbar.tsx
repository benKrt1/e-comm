import Link from 'next/link';
import { auth } from '@/auth';
import NavLinks from './NavLinks';
import styles from './Navbar.module.css';

/**
 * Global navigation. Server component: reads the session on the server so
 * the correct links render on first paint (no logged-out flash). The
 * interactive parts (active-link highlight, logout, cart badge) live in the
 * NavLinks client component.
 */
export default async function Navbar() {
  const session = await auth();
  const user = session?.user ? { name: session.user.name ?? '', role: session.user.role } : null;

  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link href="/" className={styles.brand}>
          Nord<span className={styles.accent}>Cart</span>
        </Link>

        <NavLinks user={user} />
      </nav>
    </header>
  );
}
