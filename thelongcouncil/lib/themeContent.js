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
    intro: 'Can a superpower repair its own democracy while it polices everyone else’s? Should it pull back from the world, or hold the line? Put it to Hannah Arendt, Sun Tzu, Margaret Thatcher and Ibn Khaldun, who spent a lifetime studying how empires rise and fall, and the answers are anything but obvious. Read on to see how they take it apart.',
    clusters: [
      { label: 'America’s role in the world', dilemma: 'How far should the US extend its power abroad, and when does global leadership tip into overreach?', words: ['security guarantor', 'guarantor', 'military', 'troops', 'bases', 'hormuz', 'iran', 'world’s', 'withdraw', 'protect taiwan', 'foreign'], acronyms: ['NATO'] },
      { label: 'Trump & American democracy', dilemma: 'Is the threat to American democracy a person, a movement, or the system that produced both?', words: ['trump', 'democracy', 'radicaliz', 'polaris', 'polariz', 'president', 'supreme court'] },
      { label: 'The American economy', dilemma: 'From housing to a billionaires tax, who should the American economy be made to work for?', words: ['housing', 'billionaire', 'wealth fund', 'sovereign wealth', 'inequalit', 'green card'] },
    ],
  },
  'EU': {
    intro: 'Can Europe regain its competitiveness and its power, or only manage its own decline? Should the union build an army, widen further, or risk coming apart? Konrad Adenauer and Helmut Schmidt, who helped build it, sit with Margaret Thatcher, who never trusted it, and Hannah Arendt. They will not agree, and that is the point. Start with the debates below.',
    clusters: [
      { label: 'Strategic autonomy & defence', dilemma: 'Can Europe defend itself and act on its own, or does it stay dependent on the United States?', words: ['army', 'military', 'nuclear', 'defence', 'defense', 'troops', 'autonom', 'dependency', 'dependence'], acronyms: ['NATO'] },
      { label: 'Europe and China', dilemma: 'How should Europe answer China’s subsidised exports and its technological rise?', words: ['china', 'chinese', 'import', 'subsidiz', 'subsidis', 'manufactur', 'trade war', 'tariff'] },
      { label: 'The future of the union', dilemma: 'Should the EU deepen, widen, or risk coming apart?', words: ['democrat', 'expand', 'enlarge', 'harmoniz', 'federal', 'union', 'britain', 'rejoin', 'immigration', 'downfall', 'empire'], acronyms: ['UK'] },
      { label: 'Technology & society', dilemma: 'Where should Europe draw the line on technology and online life?', words: ['social media', 'datacenter', 'regulat', 'artificial intelligence', 'train', 'emission'], acronyms: ['AI'] },
    ],
  },
  'China': {
    intro: 'Will a richer China grow freer or more assertive, and what should the world do if it moves on Taiwan? Few tables are better placed to answer: Deng Xiaoping, who opened the country, with Lee Kuan Yew and Mahathir Mohamad, who built states in its shadow, and Sun Tzu reading the strategy. Where they land is for the debates to show.',
    clusters: [
      { label: 'China’s rise', dilemma: 'Will a richer China grow freer or more assertive, and can it overtake the United States?', words: ['prosper', 'democracy', 'surpass', 'leadership', 'freedom', 'rise', 'demand'] },
      { label: 'Trade & decoupling', dilemma: 'How far should the West decouple from Chinese manufacturing and supply?', words: ['trade', 'manufactur', 'import', 'subsidiz', 'subsidis', 'asml', 'vietnam', 'supply', 'export'] },
      { label: 'Taiwan & military', dilemma: 'Would the world defend Taiwan, and should Taiwan arm itself first?', words: ['taiwan', 'military', 'invade', 'protect', 'strengthen', 'force'] },
    ],
  },
  'Netherlands': {
    intro: 'How do you fix a housing crisis, tax wealth without driving it abroad, or decide whether to reopen Groningen’s gas? Dutch questions like these draw out the council’s pragmatists, Elinor Ostrom, Lee Kuan Yew and Margaret Thatcher among them. They pull in different directions. The debates below are where you see how.',
    clusters: [
      { label: 'Society & institutions', dilemma: 'Can Dutch institutions keep up with housing, migration and a slowing economy?', words: ['housing', 'bureaucracy', 'migrant', 'aging', 'senate', 'polder', 'institution', 'jetten', 'social problem'] },
      { label: 'Wealth & redistribution', dilemma: 'Does taxing wealth make the Netherlands fairer, or simply drive capital abroad?', words: ['wealth', 'redistribut', 'tax', 'curacao', 'curaçao', 'poor', 'prosperity'] },
      { label: 'Energy & Groningen', dilemma: 'Should the Netherlands reopen Groningen gas, and how does it secure its energy?', words: ['groningen', 'gas', 'energy', 'lng', 'russian'] },
    ],
  },
  'Economy': {
    intro: 'Should the state steer the economy, or get out of the way? Who pays when AI takes the jobs? Bring questions like these to a table that seats Keynes and Hayek, Milton Friedman and Amartya Sen, alongside Lee Kuan Yew and Deng Xiaoping, who ran real economies instead of theorising about them. They rarely land in the same place. The debates below are where you find out where each one stands.',
    clusters: [
      { label: 'Taxes & Redistribution', dilemma: 'How much may the state move from those who have to those who do not before it erodes the drive that creates wealth in the first place?', words: ['wealth', 'redistribut', 'tax', 'fiscal', 'billionaire', 'inequalit', 'prosperity', 'poverty', 'shareholder', 'sovereign', 'welfare'] },
      { label: 'Trade, Tariffs & Industrial Policy', dilemma: 'Open trade lowers prices but exposes home industry, while protection shields jobs and invites retaliation.', words: ['trade', 'tariff', 'import', 'export', 'asml', 'subsid', 'protectionis', 'dumping', 'industrial', 'manufactur'] },
      { label: 'Growth vs Degrowth', dilemma: 'Is endless growth the engine of prosperity, or a threat to the planet that carries it?', words: ['degrowth', 'growth'] },
      { label: 'AI & Jobs', dilemma: 'As AI absorbs work once done by people, who captures the wealth it creates and who is left behind?', words: ['artificial intelligence', 'automat', 'datacenter', 'robot', 'jobs'], acronyms: ['AI'] },
    ],
  },
  'Governance': {
    intro: 'What makes a state actually work, when should it step in to regulate, and how does it hold together under strain? Confucius, Hannah Arendt, Elinor Ostrom and Ibn Khaldun answer from four very different traditions, separated by centuries. They rarely meet in the middle. Read on to see where they divide.',
    clusters: [
      { label: 'Institutions & the state', dilemma: 'Can the machinery of the state still deliver, and how should it be reformed when it cannot?', words: ['bureaucracy', 'institution', 'public administration', 'reform', 'rule of law', 'oversight'] },
      { label: 'Regulation & its limits', dilemma: 'When should the state step in to regulate, and when does it overreach?', words: ['regulat', 'ban', 'advertising', 'social media', 'artificial intelligence', 'oversight'], acronyms: ['AI'] },
      { label: 'Governing in hard times', dilemma: 'How should institutions hold up under war, crisis and deep division?', words: ['wartime', 'crisis', 'generation', 'future', 'discourse', 'resilien'] },
    ],
  },
  'Democracy': {
    intro: 'What breaks the cycle of radicalization, and who should get to vote? Self-rule is where this council comes alive: Hannah Arendt, Jean-Jacques Rousseau, John Rawls and Franklin Roosevelt, who held a democracy together under strain. Their answers pull apart. The debates below are where you find them.',
    clusters: [
      { label: 'Polarization & radicalization', dilemma: 'What breaks the cycle of mutual radicalization pulling democracies apart?', words: ['radicaliz', 'polaris', 'polariz', 'divisiv', 'mutual', 'extremis'] },
      { label: 'Elections & the vote', dilemma: 'Who gets to vote, how, and what makes an election legitimate?', words: ['election', 'vote', 'voter', 'voting', 'suffrage', 'referendum', 'electie', 'verkiezing'] },
      { label: 'Democratic resilience', dilemma: 'Is democracy backsliding, and how do you make it resilient again?', words: ['backslide', 'resilien', 'threat', 'decline', 'rightward', 'institution'] },
    ],
  },
  'Geopolitics': {
    intro: 'When should a nation bind itself in alliances, and when act alone? Do sanctions ever change a regime, or only harden it? Power between nations is the council’s oldest subject, argued here by Sun Tzu, Charles de Gaulle, Lee Kuan Yew and Helmut Schmidt. Realists and idealists do not agree. See how they take it apart below.',
    clusters: [
      { label: 'Alliances & autonomy', dilemma: 'When should nations bind themselves in alliances, and when act alone?', words: ['alliance', 'autonom', 'sovereign', 'dependency', 'ally', 'foreign policy'], acronyms: ['NATO', 'UN'] },
      { label: 'Sanctions & diplomacy', dilemma: 'Do sanctions and pressure change behaviour, or simply harden it?', words: ['sanction', 'diplomacy', 'negotiat', 'peace deal', 'pressure', 'kissinger'] },
      { label: 'Great-power rivalry', dilemma: 'How should middle powers navigate a contest between the United States and China?', words: ['china', 'rivalry', 'superpower', 'world leader', 'surpass', 'guarantor'] },
    ],
  },
  'War': {
    intro: 'How should the West answer Russia, and what do outsiders owe the wars of the Middle East? On war this council holds both the sword and the conscience: Sun Tzu, David Ben-Gurion, who led a state through its wars, Hannah Arendt and Eleanor Roosevelt. Strategy and conscience pull against each other. The debates are where it plays out.',
    clusters: [
      { label: 'Ukraine & Russia', dilemma: 'How should the West answer Russia’s war, and on what terms does it end?', words: ['ukraine', 'russia', 'russian', 'putin'] },
      { label: 'The Middle East', dilemma: 'From Gaza to Iran, what part should outside powers play in the region’s wars?', words: ['israel', 'gaza', 'lebanon', 'libanon', 'iran', 'hormuz', 'hamas'] },
      { label: 'Defence & deterrence', dilemma: 'How much should states arm, and does deterrence really keep the peace?', words: ['military', 'defence', 'defense', 'nuclear', 'deter', 'warfare', 'arms', 'security'], acronyms: ['NATO'] },
    ],
  },
  'Climate': {
    intro: 'How fast should we leave fossil fuels behind, and must growth itself slow to save the planet? It is the question that sets economists against ecologists. Wangari Maathai, who planted forests against poverty and drought, sits at the table with Elinor Ostrom, Margaret Thatcher and John Maynard Keynes. Where each of them lands is for the debates to tell.',
    clusters: [
      { label: 'The energy transition', dilemma: 'How fast can societies move off fossil fuels without breaking the economy?', words: ['energy', 'renewable', 'fossil', 'oil', 'gas', 'transition', 'nuclear', 'kerosene', 'emission', 'carbon'] },
      { label: 'Growth vs the planet', dilemma: 'Must we slow growth to save the climate, or can we grow our way out?', words: ['degrowth', 'growth', 'prosperity', 'environment', 'sustainab'] },
      { label: 'Nature & ecosystems', dilemma: 'Do we restore nature by stepping back, or by managing it?', words: ['nature', 'ecosystem', 'biodiversit', 'rewild', 'restore', 'pollut', 'green'] },
    ],
  },
  'AI & Technology': {
    intro: 'How do you govern AI without strangling it, and who captures the gains when it takes the jobs? The newest subject meets the oldest minds: Friedrich Hayek, Hannah Arendt, Elinor Ostrom and Lee Kuan Yew. They are anything but settled. Read on to see why.',
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

// Short labels (US, EU, AI) are handy for tag chips and slugs, but on the hub
// pages we show the full name. `about` is the grammatical form for the
// "What would they do about ___?" heading.
const THEME_DISPLAY = {
  'US': { name: 'The United States', about: 'the United States' },
  'EU': { name: 'European Union', about: 'the European Union' },
  'China': { name: 'China', about: 'China' },
  'Netherlands': { name: 'The Netherlands', about: 'the Netherlands' },
  'Economy': { name: 'Economy', about: 'the economy' },
  'Governance': { name: 'Governance', about: 'governance' },
  'Democracy': { name: 'Democracy', about: 'democracy' },
  'Geopolitics': { name: 'Geopolitics', about: 'geopolitics' },
  'War': { name: 'War', about: 'war' },
  'Climate': { name: 'Climate', about: 'climate' },
  'AI & Technology': { name: 'Artificial Intelligence & Technology', about: 'AI and technology' },
};

export function themeDisplay(label) {
  return THEME_DISPLAY[label] || { name: label, about: `the ${String(label).toLowerCase()}` };
}
