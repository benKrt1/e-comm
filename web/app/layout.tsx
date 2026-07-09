import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { ToastProvider } from '@/components/providers/ToastProvider';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        <ToastProvider>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <Navbar />
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
