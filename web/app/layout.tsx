import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { auth } from '@/auth';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { CartProvider } from '@/components/providers/CartProvider';
import Navbar from '@/components/layout/Navbar';
import './globals.css';

// Variable fonts served by next/font (self-hosted at build time → no external
// font request, no layout shift). Exposed as CSS variables consumed by
// --font-body / --font-display in globals.css.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: {
    default: 'NordCart — Nordic Tech & Audio',
    template: '%s · NordCart',
  },
  description: 'NordCart — Nordic-designed tech & audio, delivered.',
};

export const viewport: Viewport = {
  themeColor: '#111318',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // isAuthed flips on router.refresh() after login/logout and drives the
  // cart's merge/reset effect.
  const session = await auth();

  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        <ToastProvider>
          <CartProvider isAuthed={Boolean(session?.user)}>
            <a href="#main-content" className="skip-link">
              Skip to content
            </a>
            <Navbar />
            <div id="main-content" tabIndex={-1}>
              {children}
            </div>
          </CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
