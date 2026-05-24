import Head from 'next/head';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SERIF, SiteFooter, SiteHeader } from '../components/SiteChrome';

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
          content="About The Long Council — a project bringing the reasoning of historical leaders and thinkers to bear on present-day questions."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="About — The Long Council" />
        <meta
          property="og:description"
          content="About The Long Council — a project bringing the reasoning of historical leaders and thinkers to bear on present-day questions."
        />
        <meta property="og:url" content="https://www.thelongcouncil.com/about" />
        <meta property="og:image" content="https://www.thelongcouncil.com/og-default.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta
          property="og:image:alt"
          content="The Long Council — History's counsel on today's questions"
        />
        <meta property="og:site_name" content="The Long Council" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="About — The Long Council" />
        <meta
          name="twitter:description"
          content="About The Long Council — a project bringing the reasoning of historical leaders and thinkers to bear on present-day questions."
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
              className="mt-6 text-[22px] leading-[1.45] tracking-tight text-foreground sm:text-[26px]"
              style={SERIF}
            >
              The Long Council brings together leaders and thinkers from the
              past, selected for their wisdom and landmark decisions. They built
              states, governed through crises, left ideas that still shape how
              we think.
            </p>

            <p className="mt-6 text-[16px] leading-[1.75] text-foreground/85">
              This project is a way of bringing them back into the room. The aim
              is not to impersonate them, but to let their decisions and
              principles speak to the questions we face today. History does not
              repeat itself, but it rhymes. We feel that their voices are worth
              listening to.
            </p>

            {/* Council members preview */}
            <div className="mt-10 border-t border-border/70 pt-8">
              <div className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
                Among the voices
              </div>
              <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-5">
                {ROSTER.map((m) => (
                  <li key={m.name} className="flex flex-col items-center text-center">
                    <div
                      className="grid h-14 w-14 place-items-center rounded-full border border-border bg-card text-[17px] text-foreground"
                      style={SERIF}
                    >
                      {m.initial}
                    </div>
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
              actually did or wrote. The best sessions sometimes end without a
              verdict. That is often the honest answer.
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
                href="/"
                className="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 text-[13px] font-medium tracking-wide text-primary-foreground hover:bg-primary/90 transition"
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
          </div>
        </article>

        <SiteFooter />
      </div>
    </>
  );
}
