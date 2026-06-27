// Per-theme editorial content for the theme hub pages: a short intro and the
// policy clusters (concrete sub-dilemmas) that break a broad theme into
// scannable groups. Clusters are keyword-assigned over each theme's debates
// (a debate can sit in more than one), informed by an embedding clustering of
// the corpus. Labels and dilemma copy are written, not generated. A theme
// without an entry falls back to a clean debate list with no cluster section.
//
// Keep dilemmas to one sentence, no dashes, plain language.

export const THEME_CONTENT = {
  'US': {
    intro: 'How a superpower governs itself and acts on the world stage. The council weighs America’s reach abroad against its strains at home, from the threat to its own democracy to who its economy is built to serve.',
    clusters: [
      { label: 'America’s role in the world', dilemma: 'How far should the US extend its power abroad, and when does global leadership tip into overreach?', words: ['security guarantor', 'guarantor', 'military', 'troops', 'bases', 'hormuz', 'iran', 'world’s', 'withdraw', 'protect taiwan', 'foreign'], acronyms: ['NATO'] },
      { label: 'Trump & American democracy', dilemma: 'Is the threat to American democracy a person, a movement, or the system that produced both?', words: ['trump', 'democracy', 'radicaliz', 'polaris', 'polariz', 'president', 'supreme court'] },
      { label: 'The American economy', dilemma: 'From housing to a billionaires tax, who should the American economy be made to work for?', words: ['housing', 'billionaire', 'wealth fund', 'sovereign wealth', 'inequalit', 'green card'] },
    ],
  },
  'EU': {
    intro: 'Europe as a bloc, not its member states one by one. The council debates whether the union can act with one will, defend itself, and answer China and the United States, or whether it drifts toward decline.',
    clusters: [
      { label: 'Strategic autonomy & defence', dilemma: 'Can Europe defend itself and act on its own, or does it stay dependent on the United States?', words: ['army', 'military', 'nuclear', 'defence', 'defense', 'troops', 'autonom', 'dependency', 'dependence'], acronyms: ['NATO'] },
      { label: 'Europe and China', dilemma: 'How should Europe answer China’s subsidised exports and its technological rise?', words: ['china', 'chinese', 'import', 'subsidiz', 'subsidis', 'manufactur', 'trade war', 'tariff'] },
      { label: 'The future of the union', dilemma: 'Should the EU deepen, widen, or risk coming apart?', words: ['democrat', 'expand', 'enlarge', 'harmoniz', 'federal', 'union', 'britain', 'rejoin', 'immigration', 'downfall', 'empire'], acronyms: ['UK'] },
      { label: 'Technology & society', dilemma: 'Where should Europe draw the line on technology and online life?', words: ['social media', 'datacenter', 'regulat', 'artificial intelligence', 'train', 'emission'], acronyms: ['AI'] },
    ],
  },
  'China': {
    intro: 'A rising power that unsettles every other theme. The council asks whether a richer China grows freer or more assertive, how far the West should decouple, and what happens if it moves on Taiwan.',
    clusters: [
      { label: 'China’s rise', dilemma: 'Will a richer China grow freer or more assertive, and can it overtake the United States?', words: ['prosper', 'democracy', 'surpass', 'leadership', 'freedom', 'rise', 'demand'] },
      { label: 'Trade & decoupling', dilemma: 'How far should the West decouple from Chinese manufacturing and supply?', words: ['trade', 'manufactur', 'import', 'subsidiz', 'subsidis', 'asml', 'vietnam', 'supply', 'export'] },
      { label: 'Taiwan & military', dilemma: 'Would the world defend Taiwan, and should Taiwan arm itself first?', words: ['taiwan', 'military', 'invade', 'protect', 'strengthen', 'force'] },
    ],
  },
  'Netherlands': {
    intro: 'National-level Dutch policy, the member-state view beneath the European one. The council takes on housing, a slowing economy and stretched institutions, and the question of whether taxing wealth makes the country fairer or drives capital away.',
    clusters: [
      { label: 'Society & institutions', dilemma: 'Can Dutch institutions keep up with housing, migration and a slowing economy?', words: ['housing', 'bureaucracy', 'migrant', 'aging', 'senate', 'polder', 'institution', 'jetten', 'social problem'] },
      { label: 'Wealth & redistribution', dilemma: 'Does taxing wealth make the Netherlands fairer, or simply drive capital abroad?', words: ['wealth', 'redistribut', 'tax', 'curacao', 'curaçao', 'poor', 'prosperity'] },
      { label: 'Energy & Groningen', dilemma: 'Should the Netherlands reopen Groningen gas, and how does it secure its energy?', words: ['groningen', 'gas', 'energy', 'lng', 'russian'] },
    ],
  },
  'Economy': {
    intro: 'How societies steer their material life: taxation and redistribution, trade and tariffs, industrial policy, and the role of markets versus the state. Each question forces a choice between competing goods, and the council is built to hold that tension rather than resolve it cheaply.',
    clusters: [
      { label: 'Taxes & Redistribution', dilemma: 'How much may the state move from those who have to those who do not before it erodes the drive that creates wealth in the first place?', words: ['wealth', 'redistribut', 'tax', 'fiscal', 'billionaire', 'inequalit', 'prosperity', 'poverty', 'shareholder', 'sovereign', 'welfare'] },
      { label: 'Trade, Tariffs & Industrial Policy', dilemma: 'Open trade lowers prices but exposes home industry, while protection shields jobs and invites retaliation.', words: ['trade', 'tariff', 'import', 'export', 'asml', 'subsid', 'protectionis', 'dumping', 'industrial', 'manufactur'] },
      { label: 'Growth vs Degrowth', dilemma: 'Is endless growth the engine of prosperity, or a threat to the planet that carries it?', words: ['degrowth', 'growth'] },
      { label: 'AI & Jobs', dilemma: 'As AI absorbs work once done by people, who captures the wealth it creates and who is left behind?', words: ['artificial intelligence', 'automat', 'datacenter', 'robot', 'jobs'], acronyms: ['AI'] },
    ],
  },
  'Governance': {
    intro: 'The machinery of the state and the rules that bind it. The council asks whether institutions can still deliver, when the state should step in to regulate, and how government holds up under crisis and division.',
    clusters: [
      { label: 'Institutions & the state', dilemma: 'Can the machinery of the state still deliver, and how should it be reformed when it cannot?', words: ['bureaucracy', 'institution', 'public administration', 'reform', 'rule of law', 'oversight'] },
      { label: 'Regulation & its limits', dilemma: 'When should the state step in to regulate, and when does it overreach?', words: ['regulat', 'ban', 'advertising', 'social media', 'artificial intelligence', 'oversight'], acronyms: ['AI'] },
      { label: 'Governing in hard times', dilemma: 'How should institutions hold up under war, crisis and deep division?', words: ['wartime', 'crisis', 'generation', 'future', 'discourse', 'resilien'] },
    ],
  },
  'Democracy': {
    intro: 'Self-rule under strain. The council debates what breaks the cycle of radicalization, who gets to vote and how, and whether today’s democracies are quietly backsliding.',
    clusters: [
      { label: 'Polarization & radicalization', dilemma: 'What breaks the cycle of mutual radicalization pulling democracies apart?', words: ['radicaliz', 'polaris', 'polariz', 'divisiv', 'mutual', 'extremis'] },
      { label: 'Elections & the vote', dilemma: 'Who gets to vote, how, and what makes an election legitimate?', words: ['election', 'vote', 'voter', 'voting', 'suffrage', 'referendum', 'electie', 'verkiezing'] },
      { label: 'Democratic resilience', dilemma: 'Is democracy backsliding, and how do you make it resilient again?', words: ['backslide', 'resilien', 'threat', 'decline', 'rightward', 'institution'] },
    ],
  },
  'Geopolitics': {
    intro: 'How power and resources move between nations. The council weighs when to bind in alliances or act alone, whether sanctions change behaviour or harden it, and how middle powers survive a contest of giants.',
    clusters: [
      { label: 'Alliances & autonomy', dilemma: 'When should nations bind themselves in alliances, and when act alone?', words: ['alliance', 'autonom', 'sovereign', 'dependency', 'ally', 'foreign policy'], acronyms: ['NATO', 'UN'] },
      { label: 'Sanctions & diplomacy', dilemma: 'Do sanctions and pressure change behaviour, or simply harden it?', words: ['sanction', 'diplomacy', 'negotiat', 'peace deal', 'pressure', 'kissinger'] },
      { label: 'Great-power rivalry', dilemma: 'How should middle powers navigate a contest between the United States and China?', words: ['china', 'rivalry', 'superpower', 'world leader', 'surpass', 'guarantor'] },
    ],
  },
  'War': {
    intro: 'Conflict, deterrence and the terms of peace. The council takes on Russia’s war in Ukraine, the wars of the Middle East, and how much states should arm to keep the peace.',
    clusters: [
      { label: 'Ukraine & Russia', dilemma: 'How should the West answer Russia’s war, and on what terms does it end?', words: ['ukraine', 'russia', 'russian', 'putin'] },
      { label: 'The Middle East', dilemma: 'From Gaza to Iran, what part should outside powers play in the region’s wars?', words: ['israel', 'gaza', 'lebanon', 'libanon', 'iran', 'hormuz', 'hamas'] },
      { label: 'Defence & deterrence', dilemma: 'How much should states arm, and does deterrence really keep the peace?', words: ['military', 'defence', 'defense', 'nuclear', 'deter', 'warfare', 'arms', 'security'], acronyms: ['NATO'] },
    ],
  },
  'Climate': {
    intro: 'The planet and the economy that strains it. The council debates how fast to move off fossil fuels, whether growth must slow to save the climate, and how best to restore nature.',
    clusters: [
      { label: 'The energy transition', dilemma: 'How fast can societies move off fossil fuels without breaking the economy?', words: ['energy', 'renewable', 'fossil', 'oil', 'gas', 'transition', 'nuclear', 'kerosene', 'emission', 'carbon'] },
      { label: 'Growth vs the planet', dilemma: 'Must we slow growth to save the climate, or can we grow our way out?', words: ['degrowth', 'growth', 'prosperity', 'environment', 'sustainab'] },
      { label: 'Nature & ecosystems', dilemma: 'Do we restore nature by stepping back, or by managing it?', words: ['nature', 'ecosystem', 'biodiversit', 'rewild', 'restore', 'pollut', 'green'] },
    ],
  },
  'AI & Technology': {
    intro: 'The tools reshaping work, power and public life. The council asks how to govern AI without strangling it, who should own the compute behind it, and how far the state should reach into online life.',
    clusters: [
      { label: 'Regulating AI', dilemma: 'Can we govern AI without strangling the innovation that drives it?', words: ['regulat', 'artificial intelligence', 'govern', 'algorithm'], acronyms: ['AI'] },
      { label: 'Sovereignty & datacenters', dilemma: 'Who should own the compute and capabilities that power AI?', words: ['datacenter', 'capabilit', 'sovereign', 'dependency', 'asml', 'semiconduct', 'chip'] },
      { label: 'Platforms & social media', dilemma: 'How far should the state reach into social media and online life?', words: ['social media', 'platform', 'internet', 'ban'] },
      { label: 'AI & work', dilemma: 'As AI takes on human work, who captures the gains?', words: ['jobs', 'automat', 'capitalism', 'inequalit'] },
    ],
  },
};

export function themeContent(label) {
  return THEME_CONTENT[label] || null;
}
