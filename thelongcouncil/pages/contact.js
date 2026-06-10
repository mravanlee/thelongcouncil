import Head from 'next/head';
import { SERIF, SiteFooter, SiteHeader } from '../components/SiteChrome';
import ContactEmailButton from '../components/ContactEmailButton';

const DESCRIPTION =
  'Tell us what you think of The Long Council. Feedback, questions, and suggestions are welcome.';

export default function Contact() {
  return (
    <>
      <Head>
        <title>Contact · The Long Council</title>
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:title" content="Contact · The Long Council" />
        <meta property="og:description" content={DESCRIPTION} />
        <link rel="canonical" href="https://www.thelongcouncil.com/contact" />
      </Head>

      <div className="min-h-screen bg-background">
        <SiteHeader />

        <main className="mx-auto max-w-2xl px-6 py-20 text-center sm:py-28">
          <div className="text-[10px] tracking-[0.22em] uppercase text-primary">
            Get in touch
          </div>
          <h1
            className="mt-4 text-[34px] leading-[1.15] tracking-tight text-foreground sm:text-[40px]"
            style={SERIF}
          >
            Tell us what you think
          </h1>
          <p className="mx-auto mt-5 max-w-[30em] text-[16px] leading-[1.75] text-foreground/85">
            We read everything. If you have feedback, a question, or a
            suggestion, write to us.
          </p>
          <div className="mt-8 flex justify-center">
            <ContactEmailButton />
          </div>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
