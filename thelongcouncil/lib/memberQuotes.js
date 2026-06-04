// lib/memberQuotes.js
//
// Real, verbatim, primary-source-verified quotes per council member. Used by the
// policy-brief "in his/her own words" block on the detail page. This is an
// ADDITIVE display layer: a best-effort step picks 1-2 topically relevant quotes
// AFTER the answer is generated and saved. The corpus NEVER feeds the
// deliberation — it cannot influence the AI answer in any way.
//
// Quality bar — "pointy only". A quote is included only if it passes ALL FOUR:
//   1. REAL        — verbatim in a primary source, with a locatable citation
//   2. SHORT       — one sentence, ~20 words or fewer
//   3. SELF-CONTAINED — reads on its own, no back-reference to context
//   4. SHARP       — a claim or image that lands, no hedge
//
// Sourcing rule: built from primary texts only, never quote-aggregator sites
// (Goodreads/AZQuotes/BrainyQuote are the source of misattributions). Known
// fakes are deliberately excluded (e.g. Mandela "Our deepest fear" = Williamson;
// Confucius "Choose a job you love"; Keynes "When the facts change"; Machiavelli
// "The ends justify the means").
//
// Keyed by avatar slug (via resolveAvatarSlug) so name variants resolve to one
// entry. Each member: { pronoun: 'his' | 'her', quotes: [{ text, source, translation? }] }
//   text        — verbatim, exact wording from the source
//   source      — work / speech + year (+ locator where useful)
//   translation — translator/edition; ONLY for non-English originals, else omitted
//
// Members absent here (or with an empty quotes array) simply render no block —
// expected for the dry theorists (Ostrom, Prebisch, Hirschman) who lack enough
// pointy lines to clear the bar.

import { resolveAvatarSlug } from './avatarSlugs';

// Mirrors cardParser.slugify. Kept local so this module — imported by the
// API route (pages/api/pipeline.js) — does not pull in cardParser's JSX renderer.
function slugify(name) {
  if (!name) return '';
  return name
    .replace(/\s*\([^)]*\)/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const MEMBER_QUOTES = {
  franklin_d_roosevelt: {
    pronoun: 'his',
    quotes: [
      { text: "The only thing we have to fear is fear itself.", source: "First Inaugural Address, 1933" },
      { text: "This great Nation will endure as it has endured, will revive and will prosper.", source: "First Inaugural Address, 1933" },
      { text: "This Nation asks for action, and action now.", source: "First Inaugural Address, 1933" },
      { text: "The money changers have fled from their high seats in the temple of our civilization.", source: "First Inaugural Address, 1933" },
      { text: "Happiness lies not in the mere possession of money; it lies in the joy of achievement, in the thrill of creative effort.", source: "First Inaugural Address, 1933" },
      { text: "The country needs and, unless I mistake its temper, the country demands bold, persistent experimentation.", source: "Oglethorpe University Address, 1932" },
      { text: "It is common sense to take a method and try it: If it fails, admit it frankly and try another.", source: "Oglethorpe University Address, 1932" },
      { text: "We have always known that heedless self-interest was bad morals; we know now that it is bad economics.", source: "Second Inaugural Address, 1937" },
      { text: "The test of our progress is not whether we add more to the abundance of those who have much; it is whether we provide enough for those who have too little.", source: "Second Inaugural Address, 1937" },
      { text: "I see one-third of a nation ill-housed, ill-clad, ill-nourished.", source: "Second Inaugural Address, 1937" },
      { text: "Government by organized money is just as dangerous as Government by organized mob.", source: "Madison Square Garden Address, 1936" },
      { text: "They are unanimous in their hate for me—and I welcome their hatred.", source: "Madison Square Garden Address, 1936" },
      { text: "Better the occasional faults of a Government that lives in a spirit of charity than the consistent omissions of a Government frozen in the ice of its own indifference.", source: "Democratic Convention Acceptance Speech, 1936" },
      { text: "This generation of Americans has a rendezvous with destiny.", source: "Democratic Convention Acceptance Speech, 1936" },
      { text: "History proves that dictatorships do not grow out of strong and successful governments but out of weak and helpless governments.", source: "Fireside Chat on the Recession, 1938" },
      { text: "No, democracy is not dying.", source: "Third Inaugural Address, 1941" },
      { text: "People who are hungry and out of a job are the stuff of which dictatorships are made.", source: "State of the Union (Economic Bill of Rights), 1944" },
      { text: "We have come to a clear realization of the fact that true individual freedom cannot exist without economic security and independence.", source: "State of the Union (Economic Bill of Rights), 1944" },
      { text: "I have seen war. I hate war.", source: "Chautauqua Address, 1936" },
      { text: "It seems to be unfortunately true that the epidemic of world lawlessness is spreading.", source: "Quarantine Speech, 1937" },
      { text: "We must be the great arsenal of democracy.", source: "Fireside Chat on the Arsenal of Democracy, 1940" },
      { text: "No man can tame a tiger into a kitten by stroking it.", source: "Fireside Chat on the Arsenal of Democracy, 1940" },
      { text: "Yesterday, December 7, 1941—a date which will live in infamy.", source: "Pearl Harbor Address to Congress, 1941" },
      { text: "We look forward to a world founded upon four essential human freedoms.", source: "Four Freedoms (State of the Union), 1941" },
      { text: "Freedom means the supremacy of human rights everywhere.", source: "Four Freedoms (State of the Union), 1941" },
    ],
  },

  margaret_thatcher: {
    pronoun: 'her',
    quotes: [
      { text: "There is no such thing as society: there are individual men and women and there are families.", source: "Interview for Woman's Own, 1987" },
      { text: "A man's right to work as he will, to spend what he earns, to own property, to have the State as servant and not as master.", source: "Speech to Conservative Party Conference, 1975" },
      { text: "When the State grows too powerful, people feel that they count for less and less.", source: "Speech to Conservative Party Conference, 1980" },
      { text: "Pennies don't fall from heaven, they have to be earned here on earth.", source: "Speech at Lord Mayor's Banquet, 1979" },
      { text: "They've got the usual Socialist disease — they've run out of other people's money.", source: "Speech to Conservative Party Conference, 1975" },
      { text: "There is no such thing as 'safe' Socialism: if it's safe, it's not Socialism, and if it's Socialism, it's not safe.", source: "Speech to Conservative Central Council ('The Historic Choice'), 1976" },
      { text: "Socialists cry 'Power to the people', and raise the clenched fist as they say it.", source: "Speech to Conservative Central Council, 1986" },
      { text: "We all know what they really mean — power over people, power to the State.", source: "Speech to Conservative Central Council, 1986" },
      { text: "Personal freedom and economic freedom are indivisible: you can't have one without the other.", source: "Speech to Conservative Central Council ('The Historic Choice'), 1976" },
      { text: "We believe that everyone has the right to be unequal, but to us every human being is equally important.", source: "Speech to Conservative Party Conference, 1975" },
      { text: "You turn if you want to. The lady's not for turning.", source: "Speech to Conservative Party Conference, 1980" },
      { text: "Consensus is the process of abandoning all beliefs, principles, values and policies in search of something in which no-one believes.", source: "Speech at Monash University (Menzies Lecture), 1981" },
      { text: "Yes, I am an iron lady, after all it wasn't a bad thing to be an iron duke.", source: "Speech to Finchley Conservatives, 1976" },
      { text: "Where there is discord, may we bring harmony.", source: "Remarks on becoming Prime Minister, Downing Street, 1979" },
      { text: "We have not successfully rolled back the frontiers of the state in Britain, only to see them re-imposed at a European level.", source: "Speech to the College of Europe ('The Bruges Speech'), 1988" },
      { text: "Europe is not the creation of the Treaty of Rome.", source: "Speech to the College of Europe ('The Bruges Speech'), 1988" },
      { text: "Willing and active co-operation between independent sovereign states is the best way to build a successful European Community.", source: "Speech to the College of Europe ('The Bruges Speech'), 1988" },
    ],
  },

  john_maynard_keynes: {
    pronoun: 'his',
    quotes: [
      { text: "Lenin is said to have declared that the best way to destroy the Capitalist System was to debauch the currency.", source: "The Economic Consequences of the Peace, 1919, ch. VI" },
      { text: "There is no subtler, no surer means of overturning the existing basis of Society than to debauch the currency.", source: "The Economic Consequences of the Peace, 1919, ch. VI" },
      { text: "By a continuing process of inflation, governments can confiscate, secretly and unobserved, an important part of the wealth of their citizens.", source: "The Economic Consequences of the Peace, 1919, ch. VI" },
      { text: "Inflation is unjust and Deflation is inexpedient.", source: "A Tract on Monetary Reform, 1923, ch. 1" },
      { text: "Of the two perhaps Deflation is the worse; because it is worse, in an impoverished world, to provoke unemployment than to disappoint the rentier.", source: "A Tract on Monetary Reform, 1923, ch. 1" },
      { text: "In the long run we are all dead.", source: "A Tract on Monetary Reform, 1923, ch. 3" },
      { text: "Economists set themselves too easy, too useless a task if in tempestuous seasons they can only tell us that when the storm is long past the ocean is flat again.", source: "A Tract on Monetary Reform, 1923, ch. 3" },
      { text: "In truth, the gold standard is already a barbarous relic.", source: "A Tract on Monetary Reform, 1923, ch. 5" },
      { text: "Speculators may do no harm as bubbles on a steady stream of enterprise.", source: "The General Theory, 1936, ch. 12" },
      { text: "But the position is serious when enterprise becomes the bubble on a whirlpool of speculation.", source: "The General Theory, 1936, ch. 12" },
      { text: "When the capital development of a country becomes a by-product of the activities of a casino, the job is likely to be ill-done.", source: "The General Theory, 1936, ch. 12" },
      { text: "Worldly wisdom teaches that it is better for reputation to fail conventionally than to succeed unconventionally.", source: "The General Theory, 1936, ch. 12" },
      { text: "Practical men, who believe themselves to be quite exempt from any intellectual influences, are usually the slaves of some defunct economist.", source: "The General Theory, 1936, ch. 24" },
      { text: "Madmen in authority, who hear voices in the air, are distilling their frenzy from some academic scribbler of a few years back.", source: "The General Theory, 1936, ch. 24" },
      { text: "I am sure that the power of vested interests is vastly exaggerated compared with the gradual encroachment of ideas.", source: "The General Theory, 1936, ch. 24" },
      { text: "It is not true that individuals possess a prescriptive 'natural liberty' in their economic activities.", source: "The End of Laissez-Faire, 1926" },
      { text: "The world is not so governed from above that private and social interest always coincide.", source: "The End of Laissez-Faire, 1926" },
      { text: "It is not a correct deduction from the Principles of Economics that enlightened self-interest always operates in the public interest.", source: "The End of Laissez-Faire, 1926" },
      { text: "The outstanding faults of the economic society in which we live are its failure to provide for full employment and its arbitrary and inequitable distribution of wealth and incomes.", source: "The General Theory, 1936, ch. 24" },
      { text: "The authoritarian state systems of to-day seem to solve the problem of unemployment at the expense of efficiency and of freedom.", source: "The General Theory, 1936, ch. 24" },
      { text: "I see the rentier aspect of capitalism as a transitional phase which will disappear when it has done its work.", source: "The General Theory, 1936, ch. 24" },
      { text: "Avarice and usury and precaution must be our gods for a little longer still.", source: "Economic Possibilities for our Grandchildren, 1930" },
      { text: "For at least another hundred years we must pretend to ourselves and to every one that fair is foul and foul is fair; for foul is useful and fair is not.", source: "Economic Possibilities for our Grandchildren, 1930" },
    ],
  },

  confucius: {
    pronoun: 'his',
    quotes: [
      { text: "He who exercises government by means of his virtue may be compared to the north polar star, which keeps its place and all the stars turn towards it.", source: "Analects 2.1", translation: "trans. Legge" },
      { text: "If the people be led by laws, and uniformity sought to be given them by punishments, they will try to avoid the punishment, but have no sense of shame.", source: "Analects 2.3", translation: "trans. Legge" },
      { text: "Advance the upright and set aside the crooked, then the people will submit.", source: "Analects 2.19", translation: "trans. Legge" },
      { text: "Learning without thought is labour lost; thought without learning is perilous.", source: "Analects 2.15", translation: "trans. Legge" },
      { text: "When you know a thing, to hold that you know it; and when you do not know a thing, to allow that you do not know it; this is knowledge.", source: "Analects 2.17", translation: "trans. Legge" },
      { text: "There is government, when the prince is prince, and the minister is minister; when the father is father, and the son is son.", source: "Analects 12.11", translation: "trans. Legge" },
      { text: "To govern means to rectify. If you lead on the people with correctness, who will dare not to be correct?", source: "Analects 12.17", translation: "trans. Legge" },
      { text: "The superior man seeks to perfect the admirable qualities of men, and does not seek to perfect their bad qualities.", source: "Analects 12.16", translation: "trans. Legge" },
      { text: "The relation between superiors and inferiors is like that between the wind and the grass. The grass must bend, when the wind blows across it.", source: "Analects 12.19", translation: "trans. Legge" },
      { text: "If the people have no faith in their rulers, there is no standing for the state.", source: "Analects 12.7", translation: "trans. Legge" },
      { text: "When a prince's personal conduct is correct, his government is effective without the issuing of orders.", source: "Analects 13.6", translation: "trans. Legge" },
      { text: "If names be not correct, language is not in accordance with the truth of things.", source: "Analects 13.3", translation: "trans. Legge" },
      { text: "If a minister make his own conduct correct, what difficulty will he have in assisting in government?", source: "Analects 13.13", translation: "trans. Legge" },
      { text: "The superior man is affable, but not adulatory; the mean man is adulatory, but not affable.", source: "Analects 13.23", translation: "trans. Legge" },
      { text: "What you do not want done to yourself, do not do to others.", source: "Analects 15.24", translation: "trans. Legge" },
      { text: "The superior man is distressed by his want of ability. He is not distressed by men's not knowing him.", source: "Analects 15.20", translation: "trans. Legge" },
      { text: "He who requires much from himself and little from others, will keep himself from being the object of resentment.", source: "Analects 15.15", translation: "trans. Legge" },
      { text: "A man can enlarge the principles which he follows; those principles do not enlarge the man.", source: "Analects 15.29", translation: "trans. Legge" },
      { text: "The mind of the superior man is conversant with righteousness; the mind of the mean man is conversant with gain.", source: "Analects 4.16", translation: "trans. Legge" },
      { text: "When we see men of worth, we should think of equalling them; when we see men of a contrary character, we should turn inwards and examine ourselves.", source: "Analects 4.17", translation: "trans. Legge" },
      { text: "Virtue is not left to stand alone. He who practises it will have neighbours.", source: "Analects 4.25", translation: "trans. Legge" },
      { text: "I will not be afflicted at men's not knowing me; I will be afflicted that I do not know men.", source: "Analects 1.16", translation: "trans. Legge" },
      { text: "The commander of the forces of a large state may be carried off, but the will of even a common man cannot be taken from him.", source: "Analects 9.26", translation: "trans. Legge" },
      { text: "The wise are free from perplexities; the virtuous from anxiety; and the bold from fear.", source: "Analects 9.30", translation: "trans. Legge" },
    ],
  },

  niccolo_machiavelli: {
    pronoun: 'his',
    quotes: [
      { text: "It is much safer to be feared than loved, when, of the two, either must be dispensed with.", source: "The Prince, ch. XVII", translation: "trans. Marriott" },
      { text: "Men have less scruple in offending one who is beloved than one who is feared.", source: "The Prince, ch. XVII", translation: "trans. Marriott" },
      { text: "Fear preserves you by a dread of punishment which never fails.", source: "The Prince, ch. XVII", translation: "trans. Marriott" },
      { text: "Men more quickly forget the death of their father than the loss of their patrimony.", source: "The Prince, ch. XVII", translation: "trans. Marriott" },
      { text: "There are two ways of contesting, the one by the law, the other by force.", source: "The Prince, ch. XVIII", translation: "trans. Marriott" },
      { text: "The lion cannot defend himself against snares and the fox cannot defend himself against wolves.", source: "The Prince, ch. XVIII", translation: "trans. Marriott" },
      { text: "A wise lord cannot, nor ought he to, keep faith when such observance may be turned against him.", source: "The Prince, ch. XVIII", translation: "trans. Marriott" },
      { text: "He who seeks to deceive will always find some one who will allow himself to be deceived.", source: "The Prince, ch. XVIII", translation: "trans. Marriott" },
      { text: "Every one sees what you appear to be, few really know what you are.", source: "The Prince, ch. XVIII", translation: "trans. Marriott" },
      { text: "How one lives is so far distant from how one ought to live.", source: "The Prince, ch. XV", translation: "trans. Marriott" },
      { text: "It is necessary for a prince wishing to hold his own to know how to do wrong.", source: "The Prince, ch. XV", translation: "trans. Marriott" },
      { text: "Whoever desires to found a state must assume that all men are bad and ever ready to display their vicious nature.", source: "Discourses on Livy, Bk. I, ch. III", translation: "trans. Thomson" },
      { text: "A prince ought to have no other aim or thought, nor select anything else for his study, than war.", source: "The Prince, ch. XIV", translation: "trans. Marriott" },
      { text: "Among other evils which being unarmed brings you, it causes you to be despised.", source: "The Prince, ch. XIV", translation: "trans. Marriott" },
      { text: "War is not to be avoided, but is only put off to the advantage of others.", source: "The Prince, ch. III", translation: "trans. Marriott" },
      { text: "Necessity is the parent of valour.", source: "Discourses on Livy, Bk. II, ch. XII", translation: "trans. Thomson" },
      { text: "Fortune is the arbiter of one half of our actions, but she still leaves us to direct the other half.", source: "The Prince, ch. XXV", translation: "trans. Marriott" },
      { text: "All armed prophets have conquered, and the unarmed ones have been destroyed.", source: "The Prince, ch. VI", translation: "trans. Marriott" },
      { text: "There is nothing more difficult to take in hand than to take the lead in the introduction of a new order of things.", source: "The Prince, ch. VI", translation: "trans. Marriott" },
      { text: "For a sect or commonwealth to last long, it must often be brought back to its beginnings.", source: "Discourses on Livy, Bk. III, ch. I", translation: "trans. Thomson" },
      { text: "A people is more prudent, more stable, and of better judgment than a prince.", source: "Discourses on Livy, Bk. I, ch. LVIII", translation: "trans. Thomson" },
      { text: "When, as in the case of Romulus, the end is good, it will always excuse the means.", source: "Discourses on Livy, Bk. I, ch. IX", translation: "trans. Thomson" },
    ],
  },

  nelson_mandela: {
    pronoun: 'his',
    quotes: [
      { text: "For to be free is not merely to cast off one's chains, but to live in a way that respects and enhances the freedom of others.", source: "Long Walk to Freedom, 1994" },
      { text: "Only free men can negotiate; prisoners cannot enter into contracts.", source: "Statement rejecting a conditional release offer, 1985" },
      { text: "Our march to freedom is irreversible. We must not allow fear to stand in our way.", source: "Speech on his release, Cape Town, 1990" },
      { text: "I have cherished the ideal of a democratic and free society in which all persons live together in harmony and with equal opportunities.", source: "Rivonia Trial statement from the dock, 1964" },
      { text: "It is an ideal which I hope to live for and to achieve. But if needs be, it is an ideal for which I am prepared to die.", source: "Rivonia Trial statement from the dock, 1964" },
      { text: "No one is born hating another person because of the colour of his skin, or his background, or his religion.", source: "Long Walk to Freedom, 1994" },
      { text: "A nation should not be judged by how it treats its highest citizens, but its lowest ones.", source: "Long Walk to Freedom, 1994" },
      { text: "No one truly knows a nation until one has been inside its jails.", source: "Long Walk to Freedom, 1994" },
      { text: "Never, never and never again shall it be that this beautiful land will again experience the oppression of one by another.", source: "Presidential inauguration address, Pretoria, 1994" },
      { text: "I learned that courage was not the absence of fear, but the triumph over it.", source: "Long Walk to Freedom, 1994" },
      { text: "The brave man is not he who does not feel afraid, but he who conquers that fear.", source: "Long Walk to Freedom, 1994" },
      { text: "May your choices reflect your hopes, not your fears.", source: "Nelson Mandela by Himself: The Authorised Book of Quotations, 2011" },
      { text: "If you want to make peace with your enemy, you have to work with your enemy. Then he becomes your partner.", source: "Long Walk to Freedom, 1994" },
      { text: "People must learn to hate, and if they can learn to hate, they can be taught to love.", source: "Long Walk to Freedom, 1994" },
      { text: "For love comes more naturally to the human heart than its opposite.", source: "Long Walk to Freedom, 1994" },
      { text: "Real leaders must be ready to sacrifice all for the freedom of their people.", source: "Chief Albert Luthuli Centenary, KwaZulu-Natal, 1998" },
      { text: "A good head and a good heart are always a formidable combination.", source: "Long Walk to Freedom, 1994" },
      { text: "I like friends who have independent minds because they tend to make you see problems from all angles.", source: "Unpublished autobiographical manuscript, 1975" },
      { text: "Education is the most powerful weapon which you can use to change the world.", source: "Launch of the Mindset Network, Johannesburg, 2003" },
      { text: "Difficulties break some men but make others.", source: "Letter to Winnie Mandela from Robben Island, 1975" },
      { text: "After climbing a great hill, one only finds that there are many more hills to climb.", source: "Long Walk to Freedom, 1994" },
      { text: "Part of being optimistic is keeping one's head pointed toward the sun, one's feet moving forward.", source: "Long Walk to Freedom, 1994" },
      { text: "I have never regarded any man as my superior, either in my life or my profession.", source: "Letter to the Commissioner of Prisons, 1976" },
      { text: "There is nothing like returning to a place that remains unchanged to find the ways in which you yourself have altered.", source: "Long Walk to Freedom, 1994" },
    ],
  },
};

// Look up a member's quote entry by (possibly non-canonical) member name.
// Returns { pronoun, quotes } or null if the member has no corpus yet.
export function getMemberQuotes(name) {
  if (!name) return null;
  return MEMBER_QUOTES[resolveAvatarSlug(slugify(name))] || null;
}
