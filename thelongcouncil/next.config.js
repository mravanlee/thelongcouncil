/** @type {import('next').NextConfig} */

// Permanent redirects from removed duplicate debates to the kept twin, so any
// links shared before removal keep working instead of 404ing. Covers the three
// per-session paths (/archive, /brief, /who). See archive de-duplication 2026-06-16.
const DUPLICATE_REDIRECTS = {
  'eu-build-army-a9hm': 'eu-build-army-gf85',
  'possible-reverse-downfall-empire-like-eu-l8te': 'possible-reverse-downfall-empire-like-eu-8ne5',
  'whether-uk-seek-rejoin-european-union-2zu5': 'whether-united-kingdom-rejoin-european-union-ack5',
  'advertising-communication-strategies-designed-effectively-reduce-hwk0': 'designing-advertising-restrictions-counter-messaging-strategies-b5x0',
  'if-europe-pursues-degrowth-benefits-environment-is7z': 'win-european-degrowth-planet-china-nobody-sq9u',
  'rise-trump-predicted-before-happened-history-mrq5': 'trump-s-rise-predicted-conditions-made-tbsd',
  'tax-policy-maintains-welfare-state-while-cdb6': 'tax-policy-supports-welfare-state-while-o1dz',
};

const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    const out = [];
    for (const [from, to] of Object.entries(DUPLICATE_REDIRECTS)) {
      for (const base of ['/archive', '/brief', '/who']) {
        out.push({ source: `${base}/${from}`, destination: `${base}/${to}`, permanent: true });
      }
    }
    return out;
  },
};

module.exports = nextConfig;
