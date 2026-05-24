import Link from 'next/link';
import { Compass } from 'lucide-react';

export const SERIF = { fontFamily: "'Playfair Display', Georgia, serif" };

export function SiteHeader() {
  return (
    <header className="border-b border-border/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" strokeWidth={2} />
            <span
              className="text-lg tracking-[0.1em] uppercase text-foreground"
              style={SERIF}
            >
              The Long Council
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-[13px] tracking-wide text-muted-foreground sm:flex">
          <Link href="/archive" className="hover:text-foreground">
            Sessions
          </Link>
          <Link href="/council" className="hover:text-foreground">
            The Council
          </Link>
          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
          <Link
            href="/"
            className="rounded-sm bg-primary px-3 py-1.5 hover:bg-primary/90"
            style={{ color: 'var(--color-primary-foreground)' }}
          >
            Ask a question
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-10 text-[12px] tracking-wide text-muted-foreground sm:flex-row sm:items-center">
        <span className="text-primary" style={SERIF}>
          The Long Council
        </span>
        <div className="flex gap-6">
          <Link href="/council" className="hover:text-foreground">
            The Council
          </Link>
          <Link href="/archive" className="hover:text-foreground">
            Sessions
          </Link>
          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
        </div>
      </div>
    </footer>
  );
}
