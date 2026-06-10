import { ArrowRight } from 'lucide-react';

// Spam-safe email button. The address is assembled in the browser at click
// time from separate parts, so it never appears in the page's HTML source for
// scrapers to harvest. The visible label is always "Email us", never the
// address itself.
export default function ContactEmailButton() {
  const handleClick = (e) => {
    e.preventDefault();
    const user = 'alex';
    const domain = ['thelongcouncil', 'com'].join('.');
    window.location.href = `mailto:${user}@${domain}`;
  };

  return (
    <a
      href="#"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 text-[13px] font-medium tracking-wide hover:bg-primary/90 transition"
      style={{ color: 'var(--color-primary-foreground)' }}
    >
      Email us
      <ArrowRight className="h-3.5 w-3.5" />
    </a>
  );
}
