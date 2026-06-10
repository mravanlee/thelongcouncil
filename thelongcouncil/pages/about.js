import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { SERIF, SiteFooter, SiteHeader } from '../components/SiteChrome';
import ContactEmailButton from '../components/ContactEmailButton';
import { resolveAvatarSlug } from '../lib/avatarSlugs';

function slugify(name) {
  if (!name) return '';
  const base = name
    .replace(/\s*\([^)]*\)/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return resolveAvatarSlug(base);
}

function PreviewAvatar({ initial, name }) {
  const [failed, setFailed] = useState(false);
  const slug = slugify(name);
  return (
    <div className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full border border-border bg-card">
      <span className="text-[17px] text-foreground" style={SERIF}>
        {initial}
      </span>
      {!failed && slug && (
        <img
          src={`/avatars/avatar_${slug}.webp`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

const ROSTER = [
  { initial: 'C', name: 'Confucius' },
  { initial: 'K', name: 'Kautilya' },
  { initial: 'I', name: 'Ibn Khaldun' },
  { initial: 'N', name: 'Niccolò Machiavelli' },
  { initial: 'H', name: 'Hannah Arendt' },
  { initial: 'L', name: 'Lee Kuan Yew' },
  { initial: 'M', name: 'Margaret Thatcher' },
  { initial: 'F', name: 'Franklin D. Roosevelt' },
];

export default function About() {
  return (
    <>
      <Head>
        <title>About — The Long Council</title>
        <meta
          name="description"
          content="The Long Council brings together leaders and thinkers from the past. They built states, governed through crises, left ideas that still shape how we think."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="About — The Long Council" />
        <meta
          property="og:description"
          content="The Long Council brings together leaders and thinkers from the past. They built states, governed through crises, left ideas that still shape how we think."
        />
        <meta property="og:url" content="https://www.thelongcouncil.com/about" />
        <meta property="og:image" content="https://www.thelongcouncil.com/og-default.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta
          property="og:image:alt"
          content="The Long Council brings together leaders and thinkers from the past."
        />
        <meta property="og:site_name" content="The Long Council" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="About — The Long Council" />
        <meta
          name="twitter:description"
          content="The Long Council brings together leaders and thinkers from the past. They built states, governed through crises, left ideas that still shape how we think."
        />
        <meta name="twitter:image" content="https://www.thelongcouncil.com/og-default.png" />
      </Head>

      <div className="min-h-screen bg-background text-foreground antialiased">
        <SiteHeader />

        <article className="border-b border-border/70">
          <div className="mx-auto max-w-3xl px-6 pt-16 pb-20">
            <div className="text-[11px] tracking-[0.22em] uppercase text-primary">
              About
            </div>

            <p
              className="mt-6 text-[18px] leading-[1.5] tracking-tight text-foreground sm:text-[26px] sm:leading-[1.45]"
              style={SERIF}
            >
              The Long Council brings together leaders and thinkers from the
              past. They built states, governed through crises, left ideas that
              still shape how we think.
            </p>

            <p className="mt-6 text-[16px] leading-[1.75] text-foreground/85">
              This project is a way of bringing them back into the room. The aim
              is not to impersonate them, but to let their decisions speak to
              the questions we face today. History does not repeat itself, but
              it rhymes. Their voices are worth listening to.
            </p>

            {/* Council members preview */}
            <div className="mt-10 border-t border-border/70 pt-8">
              <div className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
                Among the voices
              </div>
              <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-5">
                {ROSTER.map((m) => (
                  <li key={m.name} className="flex flex-col items-center text-center">
                    <PreviewAvatar initial={m.initial} name={m.name} />
                    <div className="mt-2.5 max-w-[72px] text-[11px] leading-tight text-muted-foreground">
                      {m.name.split(' ').slice(0, -1).join(' ')}
                      <br />
                      <span className="text-foreground/80">
                        {m.name.split(' ').slice(-1)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <Link
                href="/council"
                className="mt-6 inline-flex text-[11px] tracking-[0.18em] uppercase text-primary hover:text-foreground transition"
              >
                See the full council →
              </Link>
            </div>

            <h2
              className="mt-14 text-[24px] tracking-tight text-foreground"
              style={SERIF}
            >
              How it works
            </h2>
            <p className="mt-5 text-[16px] leading-[1.75] text-foreground/85">
              You bring a question. The council selects the members whose work
              speaks most directly to it. They debate one by one, building on
              each other, pushing back, grounding every claim in what they
              actually did or wrote.
            </p>

            <h2
              className="mt-14 text-[24px] tracking-tight text-foreground"
              style={SERIF}
            >
              What to keep in mind
            </h2>
            <p className="mt-5 text-[16px] leading-[1.75] text-foreground/85">
              The roster is carefully curated, but not fixed. To ensure quality
              and relevance, the council can also bring in a voice from outside
              it when a question calls for it.
            </p>

            {/* AI disclosure */}
            <div className="mt-8 border border-border bg-secondary p-6 sm:p-7">
              <div className="text-[10px] tracking-[0.22em] uppercase text-primary">
                A note on the voices
              </div>
              <p className="mt-3 text-[15px] leading-[1.7] text-foreground/90">
                What you read is AI-generated reasoning grounded in the
                historical record, not the counsel of these people themselves.
                Treat it as you would a panel of well-read advisors: worth
                listening to, never a substitute for expertise or judgment.
              </p>
            </div>

            {/* CTA */}
            <div className="mt-14 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
              <Link
                href="/#ask"
                className="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 text-[13px] font-medium tracking-wide hover:bg-primary/90 transition"
                style={{ color: 'var(--color-primary-foreground)' }}
              >
                Ask the council a question
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/archive"
                className="text-[12px] tracking-[0.18em] uppercase text-muted-foreground hover:text-foreground transition"
              >
                Or browse past sessions →
              </Link>
            </div>

            <div className="mt-16 border-t border-border/70 pt-8">
              <p className="text-[14px] leading-[1.7] text-muted-foreground">
                A project by{' '}
                <a
                  href="https://www.linkedin.com/in/alexvanleeuwen/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-foreground transition"
                >
                  Alex van Leeuwen
                </a>
                , a tech entrepreneur, investor, and political scientist
                (University of Amsterdam). The Long Council is non-profit: no
                accounts, no ads, no data collection.
              </p>
            </div>

            {/* Contact */}
            <div className="mt-14">
              <div className="text-[10px] tracking-[0.22em] uppercase text-primary">
                Get in touch
              </div>
              <h2
                className="mt-3 text-[24px] tracking-tight text-foreground"
                style={SERIF}
              >
                Tell us what you think
              </h2>
              <p className="mt-4 text-[16px] leading-[1.75] text-foreground/85">
                We read everything. If you have a question, a suggestion, or a
                debate you want the council to take on, write to us.
              </p>
              <div className="mt-6">
                <ContactEmailButton />
              </div>
            </div>
          </div>
        </article>

        <SiteFooter />
      </div>
    </>
  );
}
