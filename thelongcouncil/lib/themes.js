// Single source of truth for the debate theme taxonomy.
//
// Used by the archive filter chips (pages/archive/index.js), and (Phase 2+) by
// the theme hub pages and the "Filed under" links on debate pages. Keeping the
// matcher here means every surface tags a debate identically.
//
// Theme -> keywords for the tag-chip filter. Each keyword is matched at
// word-start (\b<kw>) so "democra" hits "democracy"/"democratic" but not
// "epidemic". Order is the chip/display order: place themes first, then topic
// themes. "US" and "EU" live in `acronyms` (matched with full word boundaries,
// \bus\b) so they never catch "use/user" or the pronoun "us"; party words like
// "democrat" are deliberately omitted so they don't swallow every "democratic"
// (Democracy) debate. EU is the supranational/bloc lens; member-state debates
// (e.g. the Netherlands) stay in their own theme on purpose.
export const THEMES = [
  // Place
  { label: 'US', keywords: ['united states', 'u.s.', 'america', 'washington', 'congress', 'white house', 'pentagon', 'wall street', 'trump', 'biden'], acronyms: ['US', 'USA'] },
  { label: 'EU', keywords: ['europe', 'europ', 'brussels', 'eurozone', 'britain', 'german', 'french', 'italy', 'spain', 'adenauer', 'schmidt', 'monnet', 'de gaulle'], acronyms: ['EU'] },
  { label: 'China', keywords: ['china', 'chinese', 'asia', 'asian', 'beijing', 'taiwan', 'japan', 'korea', 'singapore', 'india', 'mahathir', 'lee kuan', 'deng', 'confucius', 'sun tzu'] },
  { label: 'Netherlands', keywords: ['nederland', 'dutch', 'netherlands', 'jetten', 'groningen', 'curaçao', 'rutte', 'amsterdam', 'haag', 'wilders'], acronyms: ['ASML'] },
  // Topic
  { label: 'Economy', keywords: ['econom', 'trade', 'handel', 'tariff', 'wealth', 'recession', 'inflation', 'export', 'import', 'monetary', 'fiscal', 'market', 'capital', 'industrial', 'corporate', 'business', 'shareholder'], acronyms: ['GDP'] },
  { label: 'Governance', keywords: ['governance', 'institution', 'regulat', 'rule of law', 'bureaucra', 'public administration', 'oversight'] },
  { label: 'Democracy', keywords: ['democra', 'polaris', 'polariser', 'election', 'electie', 'verkiezing', 'parlement', 'citizen', 'voter', 'vote', 'debate', 'civic', 'rechtsstaat', 'jetten'] },
  { label: 'Geopolitics', keywords: ['geopoli', 'foreign policy', 'sanction', 'alliance', 'autonom', 'sovereign', 'diplomacy', 'kissinger', 'henry kissinger'], acronyms: ['NATO', 'UN'] },
  { label: 'War', keywords: ['military', 'conflict', 'security', 'defense', 'defence', 'ukraine', 'russia', 'israel', 'gaza', 'warfare', 'sun tzu', 'churchill'], acronyms: ['NATO'] },
  { label: 'Climate', keywords: ['climat', 'energy', 'oil', 'renewable', 'emission', 'carbon', 'fossil', 'groningen', 'sustainab', 'green', 'maathai', 'nature', 'ecosystem', 'biodiversit', 'rewild'] },
  { label: 'Technology', keywords: ['technolog', 'semiconduct', 'internet', 'social media', 'platform', 'innovation'] },
  { label: 'AI', keywords: ['artificial intelligence', 'algorithm', 'machine learning', 'silicon'], acronyms: ['AI', 'ASML'] },
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const THEME_REGEX = Object.fromEntries(
  THEMES.map((t) => {
    const parts = [];
    (t.keywords || []).forEach((k) => parts.push('\\b' + escapeRegex(k.toLowerCase())));
    (t.acronyms || []).forEach((a) => parts.push('\\b' + escapeRegex(a.toLowerCase()) + '\\b'));
    return [t.label, new RegExp('(' + parts.join('|') + ')', 'i')];
  }),
);

// Topic-only haystack: question + verdict + quote. Excludes member_names so
// that a session debated by Lee Kuan Yew does not auto-match the China theme
// just because his name is on the panel.
export function topicHaystack(session) {
  return [session.display_issue, session.original_issue, session.sharpened_issue, session.teaser, session.featured_quote]
    .filter(Boolean).join(' ').toLowerCase();
}

export function matchingThemes(session) {
  const hay = topicHaystack(session);
  return THEMES.filter((t) => THEME_REGEX[t.label].test(hay)).map((t) => t.label);
}

// URL slug for a theme label. All 12 labels are ASCII today ('US' -> 'us'); the
// non-alphanumeric collapse keeps any future multi-word label clean too.
export function themeSlug(label) {
  return String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function themeBySlug(slug) {
  return THEMES.find((t) => themeSlug(t.label) === slug) || null;
}
