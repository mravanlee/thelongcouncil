import Head from 'next/head';
import Link from 'next/link';

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
      </Head>

      <Link href="/" className="mast mast-link">
        <div className="mast-name">The Long Council</div>
        <div className="mast-tag">History's counsel on today's questions</div>
      </Link>

      <nav className="nav">
        <Link href="/council" className="nav-link">The Council</Link>
        <Link href="/archive" className="nav-link">The Archive</Link>
        <Link href="/about" className="nav-link nav-active">About</Link>
        <Link href="/" className="nav-raise">Raise an issue</Link>
      </nav>

      <article className="about">
        <h1 className="about-title">About The Long Council</h1>

        <p className="about-lead">
          The Long Council brings together leaders, thinkers and strategists from the past
          — chosen for their wisdom and landmark decisions. They built states, governed
          through crises, wrote philosophy that still shapes how we think.
        </p>

        <p>
          This project is a way of bringing them back into the room. The aim is not to
          impersonate. It is to let their documented frameworks speak to questions of today.
          History does not repeat itself, but it rhymes. We feel that their voices are very
          much worth listening to.
        </p>

        <h2>How it works</h2>

        <p>
          You bring a question. The council selects the members whose work speaks most
          directly to it. They debate one by one — building on each other, pushing back,
          grounding every claim in what they actually did or wrote. The best sessions
          sometimes end without a verdict. That is often the honest answer.
        </p>

        <h2>What to keep in mind</h2>

        <p>
          The roster is carefully curated, but not fixed. To ensure quality and relevance,
          the council can also bring in a voice from outside it when a question calls for
          it.
        </p>

        <p>
          What you read is AI-generated reasoning grounded in the historical record — not
          the counsel of these people themselves. Treat it as you would the opinion of a
          very knowledgeable group of friends: worth listening to, but never a substitute
          for expertise or judgment.
        </p>

        <div className="about-footer">
          <p>
            A project by{' '}
            
              href="https://www.linkedin.com/in/alexvanleeuwen/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Alex van Leeuwen
            </a>
            {' '}— A tech entrepreneur, investor, and political scientist
            (University of Amsterdam). The Long Council is non-profit: no accounts, no ads,
            no data collection.
          </p>
        </div>
      </article>

      <footer>
        The Long Council · Counsel from history's greatest minds, brought to life by AI
      </footer>
    </>
  );
}
