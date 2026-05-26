import Head from 'next/head';
import Script from 'next/script';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* Compass favicon — matches the new editorial design (oxblood on cream). */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" />
      </Head>
      {/* Cloudflare Web Analytics — privacy-friendly, cookieless, no consent banner needed. */}
      <Script
        src="https://static.cloudflareinsights.com/beacon.min.js"
        strategy="afterInteractive"
        data-cf-beacon='{"token": "d0cfa0ecbddf4638b1282751d7dea2ee"}'
      />
      <Component {...pageProps} />
    </>
  );
}
