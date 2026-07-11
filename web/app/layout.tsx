import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { CartProvider } from '@/components/providers/CartProvider';
import { WishlistProvider } from '@/components/providers/WishlistProvider';
import Navbar from '@/components/layout/Navbar';
import './globals.css';

// Runs before first paint to set the theme from the saved choice (or the OS
// preference), so there's no flash of the wrong theme on load.
const themeInit = `(function(){try{var t=localStorage.getItem('nordcart-theme');if(!t)t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f6f9' },
    { media: '(prefers-color-scheme: dark)', color: '#111318' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <body>
        {/* No-flash theme init — must run before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {/* Client providers: Auth restores the session from the JWT cookie;
            Cart/Wishlist derive their auth state from it. */}
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <CartProvider>
                <WishlistProvider>
                  <a href="#main-content" className="skip-link">
                    Skip to content
                  </a>
                  <Navbar />
                  <div id="main-content" tabIndex={-1}>
                    {children}
                  </div>
                </WishlistProvider>
              </CartProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
