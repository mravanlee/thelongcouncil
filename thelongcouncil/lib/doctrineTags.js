// Short doctrine tags per council member — the school of thought each one
// represents. Keyed by avatar slug (the profile-file stem, i.e. the output of
// resolveAvatarSlug), so the lookup is robust to name formatting. Derived from
// each member's documented positions + core belief (see pages/council.js and
// data/profiles/*.md). 1-3 words each, 3 per member. Shown muted under the
// member name on debate pages so visitors see WHY each thinker was selected.

export const DOCTRINE_TAGS = {
  albert_hirschman: ['Unbalanced Growth', 'Exit & Voice', 'Productive Disorder'],
  ali_ibn_abi_talib: ['Justice Over Order', 'Fair Taxation', 'Accountable Power'],
  amartya_sen: ['Capability Approach', 'Development as Freedom', 'Democracy & Welfare'],
  confucius: ['Moral Authority', 'Meritocracy', 'Rule by Virtue'],
  david_ben_gurion: ['Security First', 'State Survival', 'Pragmatic Alliances'],
  deng_xiaoping: ['Pragmatic Reform', 'Gradual Experimentation', 'Results Over Doctrine'],
  eleanor_roosevelt: ['Human Rights', 'Economic Rights', 'Rights Enforcement'],
  elinor_ostrom: ['Governing the Commons', 'Polycentric Governance', 'Local Knowledge'],
  ellen_johnson_sirleaf: ['Post-Conflict Recovery', 'Institutional Credibility', "Women's Inclusion"],
  franklin_d_roosevelt: ['Decisive State Action', 'Broad Coalitions', 'Crisis Reform'],
  frantz_fanon: ['Decolonization', 'Mental Liberation', 'Anti-Colonial Critique'],
  friedrich_hayek: ['Spontaneous Order', 'The Knowledge Problem', 'Limited Government'],
  hannah_arendt: ['Democratic Pluralism', 'Political Responsibility', 'Civic Institutions'],
  helmut_schmidt: ['Crisis Leadership', 'Energy Sovereignty', 'Decisive Pragmatism'],
  ibn_khaldun: ['Social Cohesion', 'Cyclical History', 'Moderate Taxation'],
  indira_gandhi: ['Strong Central State', 'Strategic Autonomy', 'Decisive Authority'],
  jawaharlal_nehru: ['Institutions First', 'Non-Alignment', 'Scientific Self-Reliance'],
  jean_jacques_rousseau: ['The General Will', 'Social Equality', 'Popular Consent'],
  john_locke: ['Government by Consent', 'Natural Rights', 'Limited Government'],
  john_maynard_keynes: ['Aggregate Demand', 'Active Fiscal Policy', 'Managing Uncertainty'],
  john_rawls: ['Justice as Fairness', 'Veil of Ignorance', 'The Worst-Off First'],
  julius_nyerere: ['Self-Reliance', 'Anti-Dependency', 'Local Institutions'],
  kautilya: ['Statecraft', 'Fiscal Power', 'Strategic Realpolitik'],
  konrad_adenauer: ['Western Integration', 'Pooled Sovereignty', 'Moral Reckoning'],
  lee_kuan_yew: ['State Capacity', 'Strategic Development', 'Pragmatic Governance'],
  mahathir_mohamad: ['Development Sovereignty', 'Industrial Policy', 'Monetary Independence'],
  margaret_thatcher: ['Free Markets', 'Limited State', 'Rule of Law'],
  milton_friedman: ['Free Markets', 'Individual Liberty', 'Limited Government'],
  mustafa_kemal_ataturk: ['Secular Republic', 'Radical Modernization', 'Top-Down Reform'],
  nelson_mandela: ['Reconciliation', 'Moral Authority', 'Nation-Building'],
  niccolo_machiavelli: ['Realpolitik', 'Effective Power', 'Political Pragmatism'],
  olof_palme: ['Common Security', 'Moral Consistency', 'Equality & Efficiency'],
  raul_prebisch: ['Dependency Theory', 'Industrialization', 'Unequal Exchange'],
  rosa_luxemburg: ['Democratic Socialism', 'Freedom of Dissent', 'Anti-Imperialism'],
  simon_bolivar: ['Liberation', 'Strong Executive', 'Regional Unity'],
  sun_tzu: ['Strategy Over Force', 'Strategic Deception', 'Know the Enemy'],
  wangari_maathai: ['Environmental Governance', 'Community Ownership', "Women's Empowerment"],
};

export function doctrineTagsForSlug(slug) {
  return DOCTRINE_TAGS[slug] || null;
}
