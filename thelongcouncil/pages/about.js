import Head from 'next/head';
import Link from 'next/link';

export default function About() {
  return (
    <>
      <Head>
        <title>About — The Long Council</title>
        <meta
          name="description"
          content="About The Long Council — a project bringing the reasoning of 37 historical figures to bear on present-day questions."
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
          The Long Council brings together 37 figures from the past — leaders, thinkers,
          strategists — chosen for their insights, wisdom, or landmark decisions. Between them
          they built states, governed countries through challenging periods, wrote philosophy
          that still shapes how we think. Their work sits in libraries. Their frameworks almost
          never reaches the tables where current decisions are made.
        </p>

        <p>
          This project is a way of bringing them back into the room. When you ask a question
          about governance, economics or geopolitics, the most relevant voices assemble 
          from the roster and produces their collective reasoning — grounded in what they
          actually wrote, said, and decided. The aim is not to impersonate. It is to let
          documented frameworks speak to questions those people never lived to see. History does
          not repeat itself, but it rhymes — and we feel these voices are very much worth listening to.
        </p>

        <h2>How to read the counsel</h2>

        <p>
          Every member speaks in contemporary English. You are not reading their own words, but
          AI-generated reasoning grounded in their documented positions. A framing line is the
          member's thesis on the question, not a quote. The verdict is the council's collective
          finding, synthesised across their arguments. Where members disagree, the disagreement
          is named rather than smoothed over. The best sessions are often ones where the council
          does not reach a verdict — that is sometimes the honest answer.
        </p>

        <h2>The honest limit</h2>

        <p>
          This is AI-generated reasoning, not the counsel of these people. It is what a model
          trained on the historical record thinks their frameworks suggest. It is not the word
          of Hannah Arendt. It is not legal or medical advice. It is not a forecast. Treat it
          as you would the opinion of a very knowledgeable group of friends: worth listening to, but 
          never a substitute for expertise or judgment.
        </p>

        <h2>How to use it well</h2>

        <p>
          The Long Council is best when it helps you see a question you were not seeing, or
          surfaces a tension you were glossing over. It is worst when you ask it to settle
          something for you. Use it at the start of thinking, not the end. Bring a question you
          cannot resolve on your own, listen to what the council surfaces, and decide for
          yourself.
        </p>

        <div className="about-footer">
          <p>
            A project by{' '}
            <a
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
        © The Long Council · AI-generated counsel from historical figures · Not advice
      </footer>
    </>
  );
}
