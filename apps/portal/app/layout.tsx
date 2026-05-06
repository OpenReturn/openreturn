import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenReturn Portal",
  description: "Reference return portal for the OpenReturn protocol"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <Link className="brand" href="/returns/new" aria-label="OpenReturn home">
            OpenReturn
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/returns/new">Return flow</Link>
            <Link href="/dashboard">Retailer dashboard</Link>
          </nav>
        </header>
        <main id="main" className="page-shell">
          {children}
        </main>
      </body>
    </html>
  );
}
