import { useState, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// ── Council roster — 35 members ────────────────────────────────────────
const COUNCIL_MEMBERS = [
  { type: 'practitioner', monogram: 'LKY', name: 'Lee Kuan Yew', role: 'Prime Minister, Singapore 1959–90', lifespan: '1923 — 2015', country: 'Singapore', positions: ['Resilience over optimism: design policy for the worst case, not the most likely', 'Meritocracy and discipline as non-negotiable foundations of a functioning state', 'Small state survival requires making yourself indispensable to larger powers'] },
  { type: 'practitioner', monogram: 'DX', name: 'Deng Xiaoping', role: 'Paramount Leader, China 1978–92', lifespan: '1904 — 1997', country: 'China', positions: ['Cross the river by feeling the stones: pragmatic, non-ideological reform', 'Economic opening is compatible with political control if sequenced correctly', 'Absorb, adapt, indigenise: technology transfer as the engine of development'] },
  { type: 'practitioner', monogram: 'NM', name: 'Nelson Mandela', role: 'President, South Africa 1994–99', lifespan: '1918 — 2013', country: 'South Africa', positions: ['Reconciliation over retribution as the only path to a functioning post-conflict state', 'Moral authority is a strategic asset, not merely an ethical position', 'Institution-building must precede redistribution'] },
  { type: 'practitioner', monogram: 'FDR', name: 'Franklin D. Roosevelt', role: 'President, United States 1933–45', lifespan: '1882 — 1945', country: 'United States', positions: ['Government must act as insurer of last resort when markets fail at scale', 'Build the broadest possible coalition before committing to irreversible action', 'Relief, recovery and reform must run simultaneously, not sequentially'] },
  { type: 'practitioner', monogram: 'MT', name: 'Margaret Thatcher', role: 'Prime Minister, United Kingdom 1979–90', lifespan: '1925 — 2013', country: 'United Kingdom', positions: ['The state crowds out private initiative; reducing its scope is a precondition of growth', 'Property rights and rule of law are the non-negotiable foundation of a free society', 'Energy and sovereignty are inseparable strategic questions'] },
  { type: 'practitioner', monogram: 'KA', name: 'Konrad Adenauer', role: 'Chancellor, West Germany 1949–63', lifespan: '1876 — 1967', country: 'West Germany', positions: ['Western integration is the only reliable security guarantee for a vulnerable state', 'Economic recovery must precede democratic consolidation', 'Moral reckoning and institutional rebuilding must happen simultaneously'] },
  { type: 'practitioner', monogram: 'HS', name: 'Helmut Schmidt', role: 'Chancellor, West Germany 1974–82', lifespan: '1918 — 2015', country: 'West Germany', positions: ['Energy dependence is a sovereignty question, not an energy question', 'Crisis demands simultaneous action — sequencing is a luxury', 'Never eliminate your last emergency option'] },
  { type: 'practitioner', monogram: 'MM', name: 'Mahathir Mohamad', role: 'Prime Minister, Malaysia 1981–2003', lifespan: '1925 —', country: 'Malaysia', positions: ['Western economic orthodoxy is not universal — reject it when it conflicts with national interest', 'Industrial policy and state direction can outperform markets in early development', 'Monetary sovereignty is non-negotiable'] },
  { type: 'practitioner', monogram: 'LD', name: 'Lula da Silva', role: 'President, Brazil 2003–10; 2023–', lifespan: '1945 —', country: 'Brazil', positions: ['Fiscal responsibility and social investment are not mutually exclusive', 'Poverty reduction through targeted transfers produces more stable growth', 'Inequality-driven instability destroys the investment climate austerity is meant to protect'] },
  { type: 'practitioner', monogram: 'EJS', name: 'Ellen Johnson Sirleaf', role: 'President, Liberia 2006–18', lifespan: '1938 —', country: 'Liberia', positions: ['International credibility is the first asset to rebuild after conflict', "Women's participation is an economic multiplier, not a social policy", 'Post-conflict sequencing: security, then institutions, then development'] },
  { type: 'practitioner', monogram: 'IG', name: 'Indira Gandhi', role: 'Prime Minister, India 1966–77; 1980–84', lifespan: '1917 — 1984', country: 'India', positions: ['Governing a continental democracy requires centralising authority at moments of crisis', 'Non-alignment is strategic independence, not neutrality', 'Poverty elimination justifies state intervention when markets fail the majority'] },
  { type: 'practitioner', monogram: 'MKA', name: 'Mustafa Kemal Atatürk', role: 'President, Turkey 1923–38', lifespan: '1881 — 1938', country: 'Turkey', positions: ['Radical top-down transformation is sometimes the only path — gradualism preserves what must be destroyed', 'Secularism and modernity are preconditions of national sovereignty', 'A nation rebuilds fastest when it defines itself by its future, not its past'] },
  { type: 'practitioner', monogram: 'JN', name: 'Jawaharlal Nehru', role: 'Prime Minister, India 1947–64', lifespan: '1889 — 1964', country: 'India', positions: ['Democratic institutions must be built before growth — they are the precondition, not the reward', 'Non-alignment preserves strategic autonomy for states too weak to win superpower competition', 'Scientific and industrial self-reliance is the foundation of genuine independence'] },
  { type: 'practitioner', monogram: 'BG', name: 'David Ben-Gurion', role: 'Prime Minister, Israel 1948–53; 1955–63', lifespan: '1886 — 1973', country: 'Israel', positions: ['Security is the precondition of everything — a state without defensible borders cannot govern', 'State-building and war-fighting must proceed simultaneously', 'Pragmatic alliances regardless of ideology — survival trumps political purity'] },
  { type: 'practitioner', monogram: 'OP', name: 'Olof Palme', role: 'Prime Minister, Sweden 1969–76; 1982–86', lifespan: '1927 — 1986', country: 'Sweden', positions: ['Fiscal responsibility and social investment are not in tension — equality produces efficiency', "A small neutral state's foreign policy credibility derives from consistency, not military power", "Common security means you cannot be secure at your neighbour's expense — only with them"] },
  { type: 'framer', monogram: 'JMK', name: 'John Maynard Keynes', role: 'Economist · The General Theory', lifespan: '1883 — 1946', country: 'United Kingdom', positions: ['Under genuine uncertainty, insure against the worst case — not the most likely', 'Markets are not self-correcting in the short run; the state must act as stabiliser', 'In the long run we are all dead — policy must solve present problems with present tools'] },
  { type: 'framer', monogram: 'FH', name: 'Friedrich Hayek', role: 'Economist · The Road to Serfdom', lifespan: '1899 — 1992', country: 'Austria / UK', positions: ['The pretence of knowledge: no planner possesses enough information to improve on price signals', 'Spontaneous order emerges from voluntary exchange — it cannot be designed from above', 'The road to serfdom is paved with good intentions and expanded state power'] },
  { type: 'framer', monogram: 'MF', name: 'Milton Friedman', role: 'Economist · Capitalism and Freedom', lifespan: '1912 — 2006', country: 'United States', positions: ['Inflation is always and everywhere a monetary phenomenon', 'Economic freedom is a precondition of political freedom', 'Markets allocate resources more efficiently than any central authority'] },
  { type: 'framer', monogram: 'JL', name: 'John Locke', role: 'Philosopher · Two Treatises of Government', lifespan: '1632 — 1704', country: 'England', positions: ['Legitimate authority derives from the consent of the governed', 'Property rights are natural rights — the state exists to protect, not override them', 'When government violates natural rights, revolution is legitimate'] },
  { type: 'framer', monogram: 'JJR', name: 'Jean-Jacques Rousseau', role: 'Philosopher · The Social Contract', lifespan: '1712 — 1778', country: 'France', positions: ['The general will is not the sum of individual preferences — it is what the community genuinely needs', 'Inequality is not natural — it is constructed by social and economic arrangements', 'Man is born free, and everywhere he is in chains'] },
  { type: 'framer', monogram: 'JR', name: 'John Rawls', role: 'Philosopher · A Theory of Justice', lifespan: '1921 — 2002', country: 'United States', positions: ['Design policy as if you do not know which position in society you will occupy', 'Inequality is only justified when it benefits the least advantaged', 'Justice is the first virtue of social institutions — not efficiency, not growth'] },
  { type: 'framer', monogram: 'HA', name: 'Hannah Arendt', role: 'Philosopher · The Origins of Totalitarianism', lifespan: '1906 — 1975', country: 'Germany / USA', positions: ['Violence can destroy but never create political order', 'The banality of evil: atrocity does not require monsters — only people who stop thinking', 'Political participation is not a right — it is what makes us human'] },
  { type: 'framer', monogram: 'AS', name: 'Amartya Sen', role: 'Economist · Development as Freedom', lifespan: '1933 —', country: 'India / UK', positions: ['Development must be measured in human freedom and capability, not GDP', 'No famine has ever occurred in a functioning democracy with a free press', "Women's education is the single most powerful lever for development"] },
  { type: 'framer', monogram: 'AH', name: 'Albert Hirschman', role: 'Economist · Exit, Voice and Loyalty', lifespan: '1915 — 2012', country: 'Germany / USA', positions: ['Irreversible decisions demand a categorically higher threshold of justification', 'No exit option means no voice — actors without alternatives become loyal by necessity', 'Reform requires productive tension — channel conflict, do not eliminate it'] },
  { type: 'framer', monogram: 'NMa', name: 'Niccolò Machiavelli', role: 'Statesman · The Prince', lifespan: '1469 — 1527', country: 'Florence', positions: ['The question is not whether force is just — it is whether it is effective', 'A prince who cannot see three moves ahead is not strategically serious', 'It is better to be feared than loved — but best of all to be neither hated nor ignored'] },
  { type: 'framer', monogram: '孔', name: 'Confucius', role: 'Philosopher · The Analects', lifespan: '551 — 479 BC', country: 'China', positions: ['Governance is the rectification of names — call things what they are, and order follows', 'Meritocracy is the only legitimate basis for authority — not wealth, not birth', "The ruler's obligation to the people is the foundation of legitimate power"] },
  { type: 'framer', monogram: 'KT', name: 'Kautilya (Chanakya)', role: 'Statesman · The Arthashastra', lifespan: '350 — 283 BC', country: 'India', positions: ['The welfare of the state is the welfare of its people — the king who forgets this will not last', "Foreign policy is the art of identifying your enemy's enemy and making him your friend", 'A treasury without revenue is a state without spine'] },
  { type: 'framer', monogram: 'IK', name: 'Ibn Khaldun', role: 'Historian · The Muqaddimah', lifespan: '1332 — 1406', country: 'North Africa', positions: ['Social cohesion is the engine of political power — its erosion predicts civilisational decline', 'External military pressure on a society consistently strengthens its internal cohesion', 'Dynasties carry the seeds of their own decay — luxury erodes the discipline that created them'] },
  { type: 'framer', monogram: 'FF', name: 'Frantz Fanon', role: 'Philosopher · The Wretched of the Earth', lifespan: '1925 — 1961', country: 'Martinique / Algeria', positions: ['Western institutional transplants fail in post-colonial states because they carry colonial logic', 'Psychological liberation is the precondition of political liberation', 'The national bourgeoisie replaces the colonial master without changing the structure'] },
  { type: 'framer', monogram: 'RP', name: 'Raúl Prebisch', role: 'Economist · Dependency Theory', lifespan: '1901 — 1986', country: 'Argentina', positions: ['The global trading system structurally disadvantages commodity exporters — free trade is not neutral', 'Industrial policy corrects a distorted global system — it is not market distortion', 'Destroying domestic production voluntarily moves a country toward structural dependency'] },
  { type: 'framer', monogram: 'علي', name: 'Ali ibn Abi Talib', role: 'Caliph · Letter to Malik al-Ashtar', lifespan: '601 — 661 AD', country: 'Arabia', positions: ["The ruler's first obligation is justice — not power, not piety, not stability", 'Tax the people fairly — excess taxation destroys the prosperity that taxation depends on', 'Judicial independence from the ruler is the test of whether governance is legitimate'] },
  { type: 'framer', monogram: 'EO', name: 'Elinor Ostrom', role: 'Economist · Governing the Commons', lifespan: '1933 — 2012', country: 'United States', positions: ['Common resources do not inevitably collapse — communities govern without privatisation or state control', 'Institutional diversity is a strength — there is no single defensible governance structure', 'Local knowledge embedded in communities outperforms external expert solutions'] },
  { type: 'framer', monogram: '孫', name: 'Sun Tzu', role: 'Strategist · The Art of War', lifespan: '544 — 496 BC', country: 'China', positions: ['Supreme excellence in strategy is to defeat the enemy without fighting', 'Know your enemy and know yourself — in a hundred battles you will never be in peril', 'All warfare is based on deception — appear weak when strong, strong when weak'] },
  { type: 'framer', monogram: 'SB', name: 'Simón Bolívar', role: 'President, Gran Colombia 1819–30', lifespan: '1783 — 1830', country: 'Venezuela', positions: ['Liberation is the beginning, not the end — what follows is harder than the fight', 'Post-colonial republics need strong executive authority or they fragment into caudillismo', 'Regional unity or external domination — history offers no stable third option'] },
  { type: 'framer', monogram: 'JNy', name: 'Julius Nyerere', role: 'President, Tanzania 1964–85', lifespan: '1922 — 1999', country: 'Tanzania', positions: ['Self-reliance means building capacity, not isolation — but the terms of interdependence must be changed', 'Poverty is a political failure, not a natural condition — and the international order reproduces it', 'Aid without local ownership and genuine capacity transfer reproduces the dependency it claims to end'] },
];

export default function Council() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => ({
    all: COUNCIL_MEMBERS.length,
    practitioner: COUNCIL_MEMBERS.filter(m => m.type === 'practitioner').length,
    framer: COUNCIL_MEMBERS.filter(m => m.type === 'framer').length,
  }), []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return COUNCIL_MEMBERS.filter(m => {
      if (filter !== 'all' && m.type !== filter) return false;
      if (!q) return true;
      const haystack = `${m.name} ${m.role} ${m.country}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [filter, search]);

  return (
    <>
      <Head>
        <title>The Council — The Long Council</title>
        <meta name="description" content="35 historic leaders and thinkers who form The Long Council." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Link href="/" className="mast mast-link">
        <div className="mast-name">The Long Council</div>
        <div className="mast-tag">Counsel from those who governed</div>
      </Link>

      <nav className="nav">
        <Link href="/council" className="nav-link nav-active">The Council</Link>
        <span className="nav-link nav-disabled" title="Coming soon">The Archive</span>
        <Link href="/" className="nav-raise">Raise an issue</Link>
      </nav>

      <div className="council-hd">
        <h2>The Council</h2>
        <p>
          35 leaders and thinkers, selected for the depth and specificity of their documented
          record. Together they form the deliberative body — not a pantheon, but a working
          council drawn from different centuries, continents and traditions.
        </p>
        <div className="council-filters">
          <button
            className={`cf ${filter === 'all' ? 'on' : ''}`}
            onClick={() => setFilter('all')}
          >
            All — {counts.all}
          </button>
          <button
            className={`cf ${filter === 'practitioner' ? 'on' : ''}`}
            onClick={() => setFilter('practitioner')}
          >
            Practitioners — {counts.practitioner}
          </button>
          <button
            className={`cf ${filter === 'framer' ? 'on' : ''}`}
            onClick={() => setFilter('framer')}
          >
            Framers — {counts.framer}
          </button>
          <input
            className="council-search"
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="council-grid">
        {visible.map(m => (
          <div key={m.name} className={`mc ${m.type === 'framer' ? 'mc-framer' : 'mc-practitioner'}`}>
            <div className="mc-top">
              <div className={`mc-av ${m.type === 'framer' ? 'mc-av-f' : 'mc-av-p'}`}>
                {m.monogram}
              </div>
              <div className="mc-top-text">
                <div className={`mc-badge ${m.type === 'framer' ? 'mc-badge-f' : 'mc-badge-p'}`}>
                  {m.type === 'framer' ? 'Framer' : 'Practitioner'}
                </div>
                <div className="mc-dates">{m.lifespan} · {m.country}</div>
              </div>
            </div>
            <div className="mc-name">{m.name}</div>
            <div className="mc-role">{m.role}</div>
            <div className="mc-positions">
              {m.positions.map((p, i) => (
                <div key={i} className="mc-pos">{p}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="council-empty">No members match your search.</div>
      )}

      <footer>
        © The Long Council · AI-generated counsel from historical figures · Not advice
      </footer>
    </>
  );
}
