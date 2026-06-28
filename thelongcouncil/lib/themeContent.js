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
    intro: 'Few questions test the council like America. Hannah Arendt watches for the cracks in its democracy; Sun Tzu and Margaret Thatcher weigh how a superpower should use its strength; Ibn Khaldun, who studied how empires rise and fall, asks how long any of it lasts. Put a hard one to them, whether the US should pull back from the world or how it cools its own politics, and you get a real argument, not a verdict.',
    clusters: [
      { label: 'America’s role in the world', dilemma: 'How far should the US extend its power abroad, and when does global leadership tip into overreach?', words: ['security guarantor', 'guarantor', 'military', 'troops', 'bases', 'hormuz', 'iran', 'world’s', 'withdraw', 'protect taiwan', 'foreign'], acronyms: ['NATO'] },
      { label: 'Trump & American democracy', dilemma: 'Is the threat to American democracy a person, a movement, or the system that produced both?', words: ['trump', 'democracy', 'radicaliz', 'polaris', 'polariz', 'president', 'supreme court'] },
      { label: 'The American economy', dilemma: 'From housing to a billionaires tax, who should the American economy be made to work for?', words: ['housing', 'billionaire', 'wealth fund', 'sovereign wealth', 'inequalit', 'green card'] },
    ],
  },
  'EU': {
    intro: 'Europe divides its own founders. Konrad Adenauer and Helmut Schmidt built the union and want it to act as one; Margaret Thatcher distrusts every transfer of power to Brussels; Hannah Arendt asks whether a bloc this size can stay democratic at all. Ask them whether the EU should build an army, widen further, or risk coming apart, and the table splits at once.',
    clusters: [
      { label: 'Strategic autonomy & defence', dilemma: 'Can Europe defend itself and act on its own, or does it stay dependent on the United States?', words: ['army', 'military', 'nuclear', 'defence', 'defense', 'troops', 'autonom', 'dependency', 'dependence'], acronyms: ['NATO'] },
      { label: 'Europe and China', dilemma: 'How should Europe answer China’s subsidised exports and its technological rise?', words: ['china', 'chinese', 'import', 'subsidiz', 'subsidis', 'manufactur', 'trade war', 'tariff'] },
      { label: 'The future of the union', dilemma: 'Should the EU deepen, widen, or risk coming apart?', words: ['democrat', 'expand', 'enlarge', 'harmoniz', 'federal', 'union', 'britain', 'rejoin', 'immigration', 'downfall', 'empire'], acronyms: ['UK'] },
      { label: 'Technology & society', dilemma: 'Where should Europe draw the line on technology and online life?', words: ['social media', 'datacenter', 'regulat', 'artificial intelligence', 'train', 'emission'], acronyms: ['AI'] },
    ],
  },
  'China': {
    intro: 'On China the council includes people who shaped Asia themselves. Deng Xiaoping opened it; Lee Kuan Yew and Mahathir Mohamad built states in its shadow; Sun Tzu reads its strategy. Ask whether a richer China grows freer or more assertive, or what the world should do if it moves on Taiwan, and you hear insiders disagree, not outsiders guess.',
    clusters: [
      { label: 'China’s rise', dilemma: 'Will a richer China grow freer or more assertive, and can it overtake the United States?', words: ['prosper', 'democracy', 'surpass', 'leadership', 'freedom', 'rise', 'demand'] },
      { label: 'Trade & decoupling', dilemma: 'How far should the West decouple from Chinese manufacturing and supply?', words: ['trade', 'manufactur', 'import', 'subsidiz', 'subsidis', 'asml', 'vietnam', 'supply', 'export'] },
      { label: 'Taiwan & military', dilemma: 'Would the world defend Taiwan, and should Taiwan arm itself first?', words: ['taiwan', 'military', 'invade', 'protect', 'strengthen', 'force'] },
    ],
  },
  'Netherlands': {
    intro: 'Dutch questions draw out the council’s pragmatists. Elinor Ostrom, who spent her life studying how communities manage what they share, takes on housing and the polder model; Lee Kuan Yew answers as the master of small-state strategy; Margaret Thatcher presses on whether a wealth tax just drives capital away. Ask how to fix housing, or whether to reopen Groningen’s gas, and the answers pull in different directions.',
    clusters: [
      { label: 'Society & institutions', dilemma: 'Can Dutch institutions keep up with housing, migration and a slowing economy?', words: ['housing', 'bureaucracy', 'migrant', 'aging', 'senate', 'polder', 'institution', 'jetten', 'social problem'] },
      { label: 'Wealth & redistribution', dilemma: 'Does taxing wealth make the Netherlands fairer, or simply drive capital abroad?', words: ['wealth', 'redistribut', 'tax', 'curacao', 'curaçao', 'poor', 'prosperity'] },
      { label: 'Energy & Groningen', dilemma: 'Should the Netherlands reopen Groningen gas, and how does it secure its energy?', words: ['groningen', 'gas', 'energy', 'lng', 'russian'] },
    ],
  },
  'Economy': {
    intro: 'Few questions divide the council like the economy. Hayek and Friedman trust the market to sort it out; Keynes and Amartya Sen want the state to step in where it fails; Lee Kuan Yew and Deng Xiaoping speak as people who actually ran economies, not just theorised about them. Ask them how to tax wealth, or who captures the gains when AI takes the jobs, and you will not get one answer. You will get a real argument, drawn from the experience of those who lived these choices.',
    clusters: [
      { label: 'Taxes & Redistribution', dilemma: 'How much may the state move from those who have to those who do not before it erodes the drive that creates wealth in the first place?', words: ['wealth', 'redistribut', 'tax', 'fiscal', 'billionaire', 'inequalit', 'prosperity', 'poverty', 'shareholder', 'sovereign', 'welfare'] },
      { label: 'Trade, Tariffs & Industrial Policy', dilemma: 'Open trade lowers prices but exposes home industry, while protection shields jobs and invites retaliation.', words: ['trade', 'tariff', 'import', 'export', 'asml', 'subsid', 'protectionis', 'dumping', 'industrial', 'manufactur'] },
      { label: 'Growth vs Degrowth', dilemma: 'Is endless growth the engine of prosperity, or a threat to the planet that carries it?', words: ['degrowth', 'growth'] },
      { label: 'AI & Jobs', dilemma: 'As AI absorbs work once done by people, who captures the wealth it creates and who is left behind?', words: ['artificial intelligence', 'automat', 'datacenter', 'robot', 'jobs'], acronyms: ['AI'] },
    ],
  },
  'Governance': {
    intro: 'What makes a state work is old ground for this council. Confucius answers with the character of those who govern; Hannah Arendt with the institutions that restrain them; Elinor Ostrom with the rules communities write for themselves; Ibn Khaldun with why states decay. Ask when the state should regulate, or how it holds together under strain, and four very different traditions answer at once.',
    clusters: [
      { label: 'Institutions & the state', dilemma: 'Can the machinery of the state still deliver, and how should it be reformed when it cannot?', words: ['bureaucracy', 'institution', 'public administration', 'reform', 'rule of law', 'oversight'] },
      { label: 'Regulation & its limits', dilemma: 'When should the state step in to regulate, and when does it overreach?', words: ['regulat', 'ban', 'advertising', 'social media', 'artificial intelligence', 'oversight'], acronyms: ['AI'] },
      { label: 'Governing in hard times', dilemma: 'How should institutions hold up under war, crisis and deep division?', words: ['wartime', 'crisis', 'generation', 'future', 'discourse', 'resilien'] },
    ],
  },
  'Democracy': {
    intro: 'Self-rule is where this council comes alive. Hannah Arendt warns how democracies hollow out; Jean-Jacques Rousseau asks what a people sharing one will even means; John Rawls tests every answer against fairness; Franklin Roosevelt speaks as someone who held a democracy together under strain. Ask what breaks the cycle of radicalization, or who should get to vote, and centuries of hard experience pull apart.',
    clusters: [
      { label: 'Polarization & radicalization', dilemma: 'What breaks the cycle of mutual radicalization pulling democracies apart?', words: ['radicaliz', 'polaris', 'polariz', 'divisiv', 'mutual', 'extremis'] },
      { label: 'Elections & the vote', dilemma: 'Who gets to vote, how, and what makes an election legitimate?', words: ['election', 'vote', 'voter', 'voting', 'suffrage', 'referendum', 'electie', 'verkiezing'] },
      { label: 'Democratic resilience', dilemma: 'Is democracy backsliding, and how do you make it resilient again?', words: ['backslide', 'resilien', 'threat', 'decline', 'rightward', 'institution'] },
    ],
  },
  'Geopolitics': {
    intro: 'Power between nations is the council’s oldest subject. Sun Tzu reads the strategy; Charles de Gaulle insists a nation keep its own hand free; Lee Kuan Yew answers as a small state that survived among giants; Helmut Schmidt weighs the worth of alliances. Ask when to bind in alliance and when to act alone, or whether sanctions ever change a regime, and the realists and the idealists divide.',
    clusters: [
      { label: 'Alliances & autonomy', dilemma: 'When should nations bind themselves in alliances, and when act alone?', words: ['alliance', 'autonom', 'sovereign', 'dependency', 'ally', 'foreign policy'], acronyms: ['NATO', 'UN'] },
      { label: 'Sanctions & diplomacy', dilemma: 'Do sanctions and pressure change behaviour, or simply harden it?', words: ['sanction', 'diplomacy', 'negotiat', 'peace deal', 'pressure', 'kissinger'] },
      { label: 'Great-power rivalry', dilemma: 'How should middle powers navigate a contest between the United States and China?', words: ['china', 'rivalry', 'superpower', 'world leader', 'surpass', 'guarantor'] },
    ],
  },
  'War': {
    intro: 'On war the council holds both the sword and its conscience. Sun Tzu plans the campaign; David Ben-Gurion answers as a man who led a state through its wars; Hannah Arendt asks what violence does to those who use it; Eleanor Roosevelt presses for the peace that has to follow. Ask how the West should answer Russia, or what outsiders owe the Middle East, and strategy and conscience pull against each other.',
    clusters: [
      { label: 'Ukraine & Russia', dilemma: 'How should the West answer Russia’s war, and on what terms does it end?', words: ['ukraine', 'russia', 'russian', 'putin'] },
      { label: 'The Middle East', dilemma: 'From Gaza to Iran, what part should outside powers play in the region’s wars?', words: ['israel', 'gaza', 'lebanon', 'libanon', 'iran', 'hormuz', 'hamas'] },
      { label: 'Defence & deterrence', dilemma: 'How much should states arm, and does deterrence really keep the peace?', words: ['military', 'defence', 'defense', 'nuclear', 'deter', 'warfare', 'arms', 'security'], acronyms: ['NATO'] },
    ],
  },
  'Climate': {
    intro: 'The climate sets the council’s economists against its ecologists. Wangari Maathai, who planted forests to fight poverty and drought, speaks for the living world; Elinor Ostrom for the communities that must share it; Margaret Thatcher and John Maynard Keynes for an economy that cannot simply be switched off. Ask how fast to leave fossil fuels, or whether growth itself must slow, and the answers collide.',
    clusters: [
      { label: 'The energy transition', dilemma: 'How fast can societies move off fossil fuels without breaking the economy?', words: ['energy', 'renewable', 'fossil', 'oil', 'gas', 'transition', 'nuclear', 'kerosene', 'emission', 'carbon'] },
      { label: 'Growth vs the planet', dilemma: 'Must we slow growth to save the climate, or can we grow our way out?', words: ['degrowth', 'growth', 'prosperity', 'environment', 'sustainab'] },
      { label: 'Nature & ecosystems', dilemma: 'Do we restore nature by stepping back, or by managing it?', words: ['nature', 'ecosystem', 'biodiversit', 'rewild', 'restore', 'pollut', 'green'] },
    ],
  },
  'AI & Technology': {
    intro: 'The newest subject meets the oldest minds. Friedrich Hayek, who argued no central planner can know what a market knows, is set loose on the algorithm; Hannah Arendt asks what the machine does to human judgment; Elinor Ostrom, on who should own a shared resource, takes on data and compute; Lee Kuan Yew weighs technology as an engine of the state. Ask how to regulate AI, or who captures the gains when it takes the jobs, and the council is anything but settled.',
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
  'EU': { name: 'The European Union', about: 'the European Union' },
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
