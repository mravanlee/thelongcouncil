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
  // 27 Oct 2026: article sessions from before the central-claim fix, regenerated
  // with the same question and article (Alex's choice; backups in secrets/backups,
  // tlc_<code>_before_regen_20261027_184245.json). rvlb was shared on X on 24 Oct.
  'radical-right-movements-strengthen-european-cooperation-rvlb': 'radical-right-movements-strengthen-european-cooperation-vftn',
  'one-man-dominate-democracy-thirty-years-w65a': 'one-man-dominate-democracy-thirty-years-xe9c',
  'rising-prices-alone-decide-people-vote-qw5v': 'rising-prices-alone-decide-people-vote-r6nx',
  // Climate session: the first production rerun (9j37) scored 2/6 and was replaced too.
  'bear-main-cost-climate-disaster-recovery-cz0l': 'bear-main-cost-climate-disaster-recovery-lk8o',
  'bear-main-cost-climate-disaster-recovery-9j37': 'bear-main-cost-climate-disaster-recovery-lk8o',
  // Starlink session: invented Friedman-Pinochet episode in the original (Alex's choice).
  'one-private-company-control-infrastructure-critical-tj3a': 'one-private-company-control-infrastructure-critical-qhbl',
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
