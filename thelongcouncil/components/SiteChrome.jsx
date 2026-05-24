import Link from 'next/link';
import { useState } from 'react';
import { Compass, Menu, X } from 'lucide-react';

export const SERIF = { fontFamily: "'Playfair Display', Georgia, serif" };

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-border/70 relative">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="flex items-center gap-2"
          onClick={() => setOpen(false)}
        >
          <Compass className="h-5 w-5 text-primary" strokeWidth={2} />
          <span
            className="text-lg tracking-[0.1em] uppercase text-foreground"
            style={SERIF}
          >
            The Long Council
          </span>
        </Link>

        {/* Desktop nav */}
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
            href="/#ask"
            className="rounded-sm bg-primary px-3 py-1.5 hover:bg-primary/90"
            style={{ color: 'var(--color-primary-foreground)' }}
          >
            Ask a question
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="sm:hidden inline-flex items-center justify-center h-9 w-9 rounded-sm text-foreground hover:bg-secondary transition"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="sm:hidden absolute top-full left-0 right-0 bg-background border-b border-border/70 shadow-md z-50">
          <nav className="mx-auto flex max-w-6xl flex-col px-6 py-3">
            <Link
              href="/archive"
              onClick={() => setOpen(false)}
              className="py-3 text-[15px] text-foreground border-b border-border/40 last:border-0"
            >
              Sessions
            </Link>
            <Link
              href="/council"
              onClick={() => setOpen(false)}
              className="py-3 text-[15px] text-foreground border-b border-border/40 last:border-0"
            >
              The Council
            </Link>
            <Link
              href="/about"
              onClick={() => setOpen(false)}
              className="py-3 text-[15px] text-foreground border-b border-border/40 last:border-0"
            >
              About
            </Link>
            <Link
              href="/#ask"
              onClick={() => setOpen(false)}
              className="mt-3 mb-2 inline-flex items-center justify-center rounded-sm bg-primary px-4 py-2.5 text-[14px] font-medium hover:bg-primary/90"
              style={{ color: 'var(--color-primary-foreground)' }}
            >
              Ask a question
            </Link>
          </nav>
        </div>
      )}
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
