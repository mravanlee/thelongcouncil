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
// Members absent here (or with an empty quotes array) simply render no block.
// A few dry theorists (Ostrom, Hirschman, Prebisch) carry only a handful of
// pointy lines — that is fine: the selection step shows a quote only when one
// genuinely fits the session, so a small set just means they appear rarely.

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

  lee_kuan_yew: {
    pronoun: 'his',
    quotes: [
      { text: "We are pragmatists. We don't stick to any ideology.", source: "From Third World to First, 2000" },
      { text: "I was never a prisoner of any theory. What guided me were reason and reality.", source: "From Third World to First, 2000" },
      { text: "The acid test I applied to every theory or scheme was, would it work?", source: "From Third World to First, 2000" },
      { text: "The acid test of any legal system is not the grandeur of its ideal concepts, but whether it can produce order and justice.", source: "From Third World to First, 2000" },
      { text: "If Singapore is a nanny state, then I am proud to have fostered one.", source: "From Third World to First, 2000" },
      { text: "Between being loved and being feared, I have always believed Machiavelli was right.", source: "The Singapore Story, 1998" },
      { text: "If nobody is afraid of me, I'm meaningless.", source: "The Singapore Story, 1998" },
      { text: "I ignore polling as a method of government. I think that shows a certain weakness of mind.", source: "Interview, 2002" },
      { text: "Repression is a habit that grows.", source: "Singapore Legislative Assembly, 1956" },
      { text: "Poetry is a luxury we cannot afford.", source: "Address to University of Singapore students, 1968" },
      { text: "If you don't include your women graduates in your breeding pool, you would end up a more stupid society.", source: "National Day Rally speech, 1983" },
    ],
  },

  jawaharlal_nehru: {
    pronoun: 'his',
    quotes: [
      { text: "Long years ago we made a tryst with destiny, and now the time comes when we shall redeem our pledge.", source: "Tryst with Destiny, 1947" },
      { text: "At the stroke of the midnight hour, when the world sleeps, India will awake to life and freedom.", source: "Tryst with Destiny, 1947" },
      { text: "Freedom and power bring responsibility.", source: "Tryst with Destiny, 1947" },
      { text: "The past is over and it is the future that beckons to us now.", source: "Tryst with Destiny, 1947" },
      { text: "We end today a period of ill fortune, and India discovers herself again.", source: "Tryst with Destiny, 1947" },
      { text: "The light has gone out of our lives and there is darkness everywhere.", source: "Broadcast on Gandhi's death, 1948" },
      { text: "The future belongs to science and those who make friends with science.", source: "Address to the Indian Science Congress, 1938" },
      { text: "Crises and deadlocks when they occur have at least this advantage, that they force us to think.", source: "The Unity of India, 1942" },
      { text: "We must constantly remind ourselves that whatever our religion or creed, we are all one people.", source: "Radio address to the Defence Services, 1947" },
      { text: "Where freedom is menaced or justice threatened, we cannot be and shall not be neutral.", source: "Address to the U.S. Congress, 1949" },
    ],
  },

  indira_gandhi: {
    pronoun: 'her',
    quotes: [
      { text: "You cannot shake hands with a clenched fist.", source: "Press conference, New Delhi, 1971" },
      { text: "India wants to avoid a war at all costs, but it is not a one-sided affair.", source: "Press conference, New Delhi, 1971" },
      { text: "I am alive today, I may not be there tomorrow.", source: "Last speech, Bhubaneswar, 1984" },
      { text: "I shall continue to serve until my last breath, and when I die every drop of my blood will invigorate India.", source: "Last speech, Bhubaneswar, 1984" },
      { text: "A nation's strength ultimately consists in what it can do on its own, not in what it can borrow from others.", source: "Preface, Fourth Five Year Plan, 1970" },
      { text: "My father was a statesman, I am a political woman.", source: "Interview with Oriana Fallaci, 1972" },
      { text: "To be liberated, woman must feel free to be herself.", source: "True Liberation of Women speech, 1980" },
      { text: "The power to question is the basis of all human progress.", source: "Selected Speeches of Indira Gandhi (Publications Division)" },
    ],
  },

  mahathir_mohamad: {
    pronoun: 'his',
    quotes: [
      { text: "Small countries continued to be at the mercy of the powerful.", source: "Address to the UN General Assembly, 2018" },
      { text: "Kill one man, it is murder; kill a million and you become a hero.", source: "Address to the UN General Assembly, 2018" },
      { text: "A Malaysia that is a friend to all and an enemy of none.", source: "Address to the UN General Assembly, 2018" },
      { text: "Five countries on the basis of their victories cannot claim to hold the world to ransom forever.", source: "Address to the UN General Assembly, 2018" },
      { text: "I was the Prime Minister of the people, not of my family.", source: "A Doctor in the House, 2011" },
      { text: "My vision for Malaysia was for everybody, not just a politically-connected elite.", source: "A Doctor in the House, 2011" },
      { text: "A good leader does not let stereotypes go unchallenged.", source: "A Doctor in the House, 2011" },
      { text: "Perfect people simply do not exist.", source: "A Doctor in the House, 2011" },
    ],
  },

  ellen_johnson_sirleaf: {
    pronoun: 'her',
    quotes: [
      { text: "If your dreams do not scare you, they are not big enough.", source: "Harvard commencement address, 2011" },
      { text: "The size of your dreams must always exceed your current capacity to achieve them.", source: "Harvard commencement address, 2011" },
      { text: "Be not afraid to denounce injustice, though you may be outnumbered.", source: "Nobel Peace Prize Lecture, 2011" },
      { text: "Be not afraid to seek peace, even if your voice may be small.", source: "Nobel Peace Prize Lecture, 2011" },
      { text: "Only through service is one's life truly blessed.", source: "Nobel Peace Prize Lecture, 2011" },
      { text: "Access to quality education is the social justice issue of our time.", source: "Nobel Peace Prize Lecture, 2011" },
      { text: "Surely there is no place for a continuing belief that leadership qualities belong to only one gender.", source: "Nobel Peace Prize Lecture, 2011" },
      { text: "These rights are not given to us by governments, which might revoke them at their pleasure.", source: "Nobel Peace Prize Lecture, 2011" },
    ],
  },

  wangari_maathai: {
    pronoun: 'her',
    quotes: [
      { text: "Sustainable development, democracy and peace are indivisible.", source: "Nobel Peace Prize Lecture, 2004" },
      { text: "There can be no peace without equitable development; and there can be no development without sustainable management of the environment.", source: "Nobel Peace Prize Lecture, 2004" },
      { text: "Responsible governance of the environment was impossible without democratic space.", source: "Nobel Peace Prize Lecture, 2004" },
      { text: "We are called to assist the Earth to heal her wounds and in the process heal our own.", source: "Nobel Peace Prize Lecture, 2004" },
      { text: "In the course of history, there comes a time when humanity is called to shift to a new level of consciousness.", source: "Nobel Peace Prize Lecture, 2004" },
      { text: "I have always believed that solutions to most of our problems must come from us.", source: "Nobel Peace Prize Lecture, 2004" },
      { text: "Civil society should embrace not only their rights but also their responsibilities.", source: "Nobel Peace Prize Lecture, 2004" },
      { text: "The choice is ours.", source: "Nobel Peace Prize Lecture, 2004" },
    ],
  },

  julius_nyerere: {
    pronoun: 'his',
    quotes: [
      { text: "Independence means self-reliance.", source: "The Arusha Declaration, 1967" },
      { text: "Independence cannot be real if a nation depends upon gifts and loans from another for its development.", source: "The Arusha Declaration, 1967" },
      { text: "It is stupid to rely on money as the major instrument of development when we know only too well that our country is poor.", source: "The Arusha Declaration, 1967" },
      { text: "We made a mistake in choosing money, something we do not have, to be the big instrument of our development.", source: "The Arusha Declaration, 1967" },
      { text: "In order to prevent exploitation it is necessary for everybody to work and to live on his own labour.", source: "The Arusha Declaration, 1967" },
      { text: "We have been oppressed a great deal, we have been exploited a great deal and we have been disregarded a great deal.", source: "The Arusha Declaration, 1967" },
    ],
  },

  eleanor_roosevelt: {
    pronoun: 'her',
    quotes: [
      { text: "You must do the thing you think you cannot do.", source: "You Learn by Living, 1960" },
      { text: "You gain strength, courage and confidence by every experience in which you really stop to look fear in the face.", source: "You Learn by Living, 1960" },
      { text: "We must not be confused about what freedom is.", source: "The Struggle for Human Rights, 1948" },
      { text: "Human rights exist to the degree that they are respected by people in relations with each other and by governments in relations with their citizens.", source: "The Struggle for Human Rights, 1948" },
      { text: "In the totalitarian state a trade-union is an instrument used by the government to enforce duties, not to assert rights.", source: "The Struggle for Human Rights, 1948" },
    ],
  },

  helmut_schmidt: {
    pronoun: 'his',
    quotes: [
      { text: "Democracy is not a condition, democracy is a process.", source: "Gefragt: Helmut Schmidt, 1969", translation: "trans. from German" },
      { text: "Democracy consists of debate, and then a decision on the basis of the debate.", source: "Gefragt: Helmut Schmidt, 1969", translation: "trans. from German" },
      { text: "Politics is not just a mental sport; politics is also action.", source: "Gefragt: Helmut Schmidt, 1969", translation: "trans. from German" },
      { text: "There are times when preserving what has been achieved is the maximum of the achievable.", source: "Helmut-Schmidt-Stiftung Zitatesammlung, 1978", translation: "trans. from German" },
      { text: "A snail's pace is the normal pace of every democracy.", source: "Die Zeit, 2003", translation: "trans. from German" },
      { text: "The rule of law has not to win, nor has it to lose; it has to exist.", source: "Die Zeit, 2007", translation: "trans. from German" },
      { text: "Anyone who has visions should go see a doctor.", source: "Election campaign remark, c. 1980", translation: "trans. from German" },
      { text: "On the fundamental questions one has to be naive.", source: "Weggefährten, 1996", translation: "trans. from German" },
      { text: "I am indeed a pragmatist.", source: "Helmut-Schmidt-Stiftung Zitatesammlung, 1976", translation: "trans. from German" },
    ],
  },

  konrad_adenauer: {
    pronoun: 'his',
    quotes: [
      { text: "Democracy is more than a parliamentary form of government; it is a worldview.", source: "Erinnerungen 1945–1953, 1965", translation: "trans. from German" },
      { text: "Democracy must be lived.", source: "Cadenabbia, 1964", translation: "trans. from German" },
      { text: "I hold the view that the opposition is a necessity of the state.", source: "Bundestag, 1949", translation: "trans. from German" },
      { text: "Personal freedom is and remains the highest good of human beings.", source: "CDU party congress, Recklinghausen, 1948", translation: "trans. from German" },
      { text: "Peace without freedom is no peace.", source: "Christmas address, 1952", translation: "trans. from German" },
      { text: "The age of the nation-state is over.", source: "Bulletin Nr. 69/55, 1955", translation: "trans. from German" },
      { text: "A united Europe would be an imperative necessity even if there were no Soviet danger at all.", source: "Die Zeit, 1952", translation: "trans. from German" },
      { text: "Politics is the art of realizing what has been recognized as right on an ethical basis.", source: "Washington D.C., 1957", translation: "trans. from German" },
      { text: "Power in itself is nothing evil, but power can become something very evil.", source: "Cologne, 1947", translation: "trans. from German" },
      { text: "One of the main things in politics is that one does not chase after fantasies or utopias.", source: "Dortmund, 1953", translation: "trans. from German" },
    ],
  },

  olof_palme: {
    pronoun: 'his',
    quotes: [
      { text: "Politics, comrades, is to want something.", source: "Speech to the SSU congress, 1964", translation: "trans. from Swedish" },
      { text: "Social Democratic politics is to want change, because change promises improvement.", source: "Speech to the SSU congress, 1964", translation: "trans. from Swedish" },
      { text: "Every human being has their purpose within themselves; no one may be reduced to merely another's tool.", source: "Speech to the SSU congress, 1964", translation: "trans. from Swedish" },
      { text: "Freedom we reach not against society but, to a substantial extent, through society.", source: "Speech to the SSU congress, 1964", translation: "trans. from Swedish" },
      { text: "The feeling of revolt against injustice knows no borders.", source: "Speech to the SSU congress, 1964", translation: "trans. from Swedish" },
      { text: "Alone we can do little; together we can accomplish great deeds.", source: "Speech to the SSU congress, 1964", translation: "trans. from Swedish" },
      { text: "This is our world. We depend on it. Toward it we bear responsibility.", source: "Speech to the SSU congress, 1964", translation: "trans. from Swedish" },
    ],
  },

  friedrich_hayek: {
    pronoun: 'his',
    quotes: [
      { text: "The more the state plans the more difficult planning becomes for the individual.", source: "The Road to Serfdom, 1944, ch. 6" },
      { text: "Government in all its actions is bound by rules fixed and announced beforehand.", source: "The Road to Serfdom, 1944, ch. 6" },
      { text: "The principle that the end justifies the means is in individualist ethics regarded as the denial of all morals.", source: "The Road to Serfdom, 1944, ch. 11" },
      { text: "To be controlled in our economic pursuits means to be controlled in everything.", source: "The Road to Serfdom, 1944, ch. 7" },
      { text: "We must look at the price system as a mechanism for communicating information if we want to understand its real function.", source: "The Use of Knowledge in Society, 1945" },
      { text: "The most significant fact about this system is the economy of knowledge with which it operates.", source: "The Use of Knowledge in Society, 1945" },
      { text: "Liberty and responsibility are inseparable.", source: "The Constitution of Liberty, 1960, ch. 5" },
      { text: "A claim for equality of material position can be met only by a government with totalitarian powers.", source: "The Constitution of Liberty, 1960, ch. 6" },
      { text: "Freedom granted only when it is known beforehand that its effects will be beneficial is not freedom.", source: "The Constitution of Liberty, 1960, ch. 2" },
      { text: "The case for individual freedom rests chiefly on the recognition of the inevitable ignorance of all of us.", source: "The Constitution of Liberty, 1960, ch. 2" },
      { text: "Coercion is evil precisely because it thus eliminates an individual as a thinking and valuing person.", source: "The Constitution of Liberty, 1960, ch. 1" },
      { text: "If we knew how freedom would be used, the case for it would largely disappear.", source: "The Constitution of Liberty, 1960, ch. 2" },
    ],
  },

  milton_friedman: {
    pronoun: 'his',
    quotes: [
      { text: "The great threat to freedom is the concentration of power.", source: "Capitalism and Freedom, 1962, ch. 1" },
      { text: "The kind of economic organization that provides economic freedom directly also promotes political freedom.", source: "Capitalism and Freedom, 1962, ch. 1" },
      { text: "The great advances of civilization have never come from centralized government.", source: "Capitalism and Freedom, 1962, ch. 1" },
      { text: "A major source of objection to a free economy is precisely that it gives people what they want instead of what a particular group thinks they ought to want.", source: "Capitalism and Freedom, 1962, ch. 1" },
      { text: "Underlying most arguments against the free market is a lack of belief in freedom itself.", source: "Capitalism and Freedom, 1962, ch. 1" },
      { text: "Inflation is always and everywhere a monetary phenomenon.", source: "The Counter-Revolution in Monetary Theory, 1970" },
      { text: "Inflation is the one form of taxation that can be imposed without legislation.", source: "What Price Guideposts?, 1966" },
      { text: "A society that puts equality before freedom will get neither.", source: "Free to Choose, 1980, ch. 5" },
      { text: "A society that puts freedom before equality will get a high degree of both.", source: "Free to Choose, 1980, ch. 5" },
      { text: "Nobody spends somebody else's money as carefully as he spends his own.", source: "Free to Choose (TV series), 1980" },
      { text: "No exchange takes place unless both parties benefit.", source: "Free to Choose, 1980, ch. 1" },
    ],
  },

  john_locke: {
    pronoun: 'his',
    quotes: [
      { text: "No one ought to harm another in his life, health, liberty, or possessions.", source: "Two Treatises of Government, 1689, II §6" },
      { text: "The end of law is not to abolish or restrain, but to preserve and enlarge freedom.", source: "Two Treatises of Government, 1689, II §57" },
      { text: "Where there is no law, there is no freedom.", source: "Two Treatises of Government, 1689, II §57" },
      { text: "Men being by nature all free, equal, and independent, no one can be subjected to the political power of another without his own consent.", source: "Two Treatises of Government, 1689, II §95" },
      { text: "There remains still in the people a supreme power to remove or alter the legislative.", source: "Two Treatises of Government, 1689, II §149" },
      { text: "Where-ever law ends, tyranny begins.", source: "Two Treatises of Government, 1689, II §202" },
      { text: "Tyranny is the exercise of power beyond right.", source: "Two Treatises of Government, 1689, II §199" },
      { text: "Whensoever the legislators endeavour to take away and destroy the property of the people, they put themselves into a state of war with the people.", source: "Two Treatises of Government, 1689, II §222" },
      { text: "Reason must be our last judge and guide in everything.", source: "An Essay Concerning Human Understanding, 1689, IV.xix.14" },
      { text: "New opinions are always suspected, and usually opposed, without any other reason but because they are not already common.", source: "An Essay Concerning Human Understanding, 1689" },
      { text: "No man's knowledge here can go beyond his experience.", source: "An Essay Concerning Human Understanding, 1689, II.i.19" },
    ],
  },

  hannah_arendt: {
    pronoun: 'her',
    quotes: [
      { text: "The trouble with Eichmann was precisely that so many were like him, and that the many were neither perverted nor sadistic, that they were, and still are, terribly and terrifyingly normal.", source: "Eichmann in Jerusalem, 1963" },
      { text: "Power corresponds to the human ability not just to act but to act in concert.", source: "On Violence, 1970" },
      { text: "Power springs up between men when they act together and vanishes the moment they disperse.", source: "The Human Condition, 1958, §28" },
      { text: "Action, as distinguished from fabrication, is never possible in isolation.", source: "The Human Condition, 1958, §24" },
      { text: "The ideal subject of totalitarian rule is people for whom the distinction between fact and fiction no longer exists.", source: "The Origins of Totalitarianism, 1951" },
      { text: "Total terror is the essence of totalitarian government.", source: "The Origins of Totalitarianism, 1951" },
      { text: "The aim of totalitarian education has never been to instill convictions but to destroy the capacity to form any.", source: "The Origins of Totalitarianism, 1951" },
      { text: "No one has ever counted truthfulness among the political virtues.", source: "Truth and Politics, 1967" },
      { text: "Revolutions are the only political events which confront us directly and inevitably with the problem of beginning.", source: "On Revolution, 1963" },
    ],
  },

  jean_jacques_rousseau: {
    pronoun: 'his',
    quotes: [
      { text: "Man was born free, and he is everywhere in chains.", source: "The Social Contract, Bk. I, ch. 1", translation: "trans. Cranston" },
      { text: "Those who think themselves the masters of others are indeed greater slaves than they.", source: "The Social Contract, Bk. I, ch. 1", translation: "trans. Cranston" },
      { text: "The strongest man is never strong enough to be master all the time, unless he transforms force into right and obedience into duty.", source: "The Social Contract, Bk. I, ch. 3", translation: "trans. Cranston" },
      { text: "To renounce freedom is to renounce one's humanity, one's rights as a man and equally one's duties.", source: "The Social Contract, Bk. I, ch. 4", translation: "trans. Cranston" },
      { text: "The general will is always right and always tends towards the public good.", source: "The Social Contract, Bk. II, ch. 3", translation: "trans. Cranston" },
      { text: "The first man who, having enclosed a piece of ground, said 'This is mine,' was the true founder of civil society.", source: "Discourse on the Origin of Inequality, Part II", translation: "trans. Cole" },
      { text: "Everything is good as it leaves the hands of the Author of things; everything degenerates in the hands of man.", source: "Emile, or On Education, Bk. I", translation: "trans. Bloom" },
    ],
  },

  ibn_khaldun: {
    pronoun: 'his',
    quotes: [
      { text: "At the beginning of the dynasty, taxation yields a large revenue from small assessments. At the end of the dynasty, taxation yields a small revenue from large assessments.", source: "Muqaddimah, Bk. I, ch. 3", translation: "trans. Rosenthal" },
      { text: "Royal authority and dynastic power are attained only through a group and group feeling.", source: "Muqaddimah, Bk. I, ch. 3", translation: "trans. Rosenthal" },
      { text: "Dynasties have a natural life span like individuals.", source: "Muqaddimah, Bk. I, ch. 3", translation: "trans. Rosenthal" },
      { text: "As a rule, no dynasty lasts beyond the life span of three generations.", source: "Muqaddimah, Bk. I, ch. 3", translation: "trans. Rosenthal" },
      { text: "The vanquished always want to imitate the victor in his distinctive marks, his dress, his occupation, and all his other conditions and customs.", source: "Muqaddimah, Bk. I, ch. 2", translation: "trans. Rosenthal" },
      { text: "Injustice brings about the ruin of civilization.", source: "Muqaddimah, Bk. I, ch. 3", translation: "trans. Rosenthal" },
    ],
  },

  frantz_fanon: {
    pronoun: 'his',
    quotes: [
      { text: "Decolonization is always a violent phenomenon.", source: "The Wretched of the Earth, 'Concerning Violence'", translation: "trans. Farrington" },
      { text: "The naked truth of decolonization evokes for us the searing bullets and bloodstained knives which emanate from it.", source: "The Wretched of the Earth, 'Concerning Violence'", translation: "trans. Farrington" },
      { text: "For the native, life can only spring up again out of the rotting corpse of the settler.", source: "The Wretched of the Earth, 'Concerning Violence'", translation: "trans. Farrington" },
      { text: "At the level of individuals, violence is a cleansing force.", source: "The Wretched of the Earth, 'Concerning Violence'", translation: "trans. Farrington" },
      { text: "Each generation must, out of relative obscurity, discover its mission, fulfill it, or betray it.", source: "The Wretched of the Earth, 'On National Culture'", translation: "trans. Farrington" },
      { text: "Leave this Europe where they are never done talking of Man, yet murder men everywhere they find them.", source: "The Wretched of the Earth, 'Conclusion'", translation: "trans. Farrington" },
      { text: "The black man wants to be white. The white man slaves to reach a human level.", source: "Black Skin, White Masks, Introduction", translation: "trans. Markmann" },
      { text: "To speak a language is to take on a world, a culture.", source: "Black Skin, White Masks, ch. 1", translation: "trans. Markmann" },
      { text: "What is often called the black soul is a white man's artifact.", source: "Black Skin, White Masks, ch. 1", translation: "trans. Markmann" },
      { text: "I am my own foundation.", source: "Black Skin, White Masks, Conclusion", translation: "trans. Markmann" },
      { text: "O my body, make of me always a man who questions!", source: "Black Skin, White Masks, Conclusion", translation: "trans. Markmann" },
    ],
  },

  sun_tzu: {
    pronoun: 'his',
    quotes: [
      { text: "All warfare is based on deception.", source: "The Art of War, ch. I", translation: "trans. Giles" },
      { text: "Attack him where he is unprepared, appear where you are not expected.", source: "The Art of War, ch. I", translation: "trans. Giles" },
      { text: "If your opponent is of choleric temper, seek to irritate him.", source: "The Art of War, ch. I", translation: "trans. Giles" },
      { text: "There is no instance of a country having benefited from prolonged warfare.", source: "The Art of War, ch. II", translation: "trans. Giles" },
      { text: "Supreme excellence consists in breaking the enemy's resistance without fighting.", source: "The Art of War, ch. III", translation: "trans. Giles" },
      { text: "He will win who knows when to fight and when not to fight.", source: "The Art of War, ch. III", translation: "trans. Giles" },
      { text: "If you know the enemy and know yourself, you need not fear the result of a hundred battles.", source: "The Art of War, ch. III", translation: "trans. Giles" },
      { text: "The good fighters of old first put themselves beyond the possibility of defeat, and then waited for an opportunity of defeating the enemy.", source: "The Art of War, ch. IV", translation: "trans. Giles" },
      { text: "The victorious strategist only seeks battle after the victory has been won.", source: "The Art of War, ch. IV", translation: "trans. Giles" },
      { text: "Water shapes its course according to the nature of the ground over which it flows.", source: "The Art of War, ch. VI", translation: "trans. Giles" },
      { text: "Let your plans be dark and impenetrable as night, and when you move, fall like a thunderbolt.", source: "The Art of War, ch. VII", translation: "trans. Giles" },
      { text: "Rapidity is the essence of war.", source: "The Art of War, ch. XI", translation: "trans. Giles" },
      { text: "Throw your soldiers into positions whence there is no escape, and they will prefer death to flight.", source: "The Art of War, ch. XI", translation: "trans. Giles" },
    ],
  },

  ali_ibn_abi_talib: {
    pronoun: 'his',
    quotes: [
      { text: "He who adopts greed as a habit devalues himself.", source: "Nahj al-Balagha, Saying 2", translation: "trans. Sayyid Ali Reza" },
      { text: "Meet people in such a manner that if you die they should weep for you and if you live they should long for you.", source: "Nahj al-Balagha, Saying 10", translation: "trans. Sayyid Ali Reza" },
      { text: "When you gain power over your adversary, pardon him by way of thanks for being able to overpower him.", source: "Nahj al-Balagha, Saying 11", translation: "trans. Sayyid Ali Reza" },
      { text: "The most capable of pardoning is he who is the most powerful to punish.", source: "Nahj al-Balagha, Saying 52", translation: "trans. Sayyid Ali Reza" },
      { text: "The tongue of the wise man is behind his heart, while the heart of the fool is behind his tongue.", source: "Nahj al-Balagha, Saying 40", translation: "trans. Sayyid Ali Reza" },
      { text: "The worth of every man is in his attainments.", source: "Nahj al-Balagha, Saying 81", translation: "trans. Sayyid Ali Reza" },
      { text: "Greed is perpetual slavery.", source: "Nahj al-Balagha, Saying 180", translation: "trans. Sayyid Ali Reza" },
      { text: "The oppressor who starts oppression will tomorrow bite his hands in regret.", source: "Nahj al-Balagha, Saying 186", translation: "trans. Sayyid Ali Reza" },
      { text: "Whoever does not know his own worth is ruined.", source: "Nahj al-Balagha, Saying 149", translation: "trans. Sayyid Ali Reza" },
      { text: "Habituate your heart to mercy for the subjects and to affection and kindness for them.", source: "Nahj al-Balagha, Letter 53", translation: "trans. Sayyid Ali Reza" },
      { text: "Do not regret forgiving, nor rejoice over punishing.", source: "Nahj al-Balagha, Letter 53", translation: "trans. Sayyid Ali Reza" },
      { text: "Allah hears the prayer of the oppressed and is on the lookout for the oppressors.", source: "Nahj al-Balagha, Letter 53", translation: "trans. Sayyid Ali Reza" },
    ],
  },

  kautilya: {
    pronoun: 'his',
    quotes: [
      { text: "In the happiness of his subjects lies the king's happiness; in their welfare his welfare.", source: "Arthashastra, Bk. 1, ch. 19", translation: "trans. Shamasastry" },
      { text: "Whatever pleases himself he shall not consider as good, but whatever pleases his subjects he shall consider as good.", source: "Arthashastra, Bk. 1, ch. 19", translation: "trans. Shamasastry" },
      { text: "The root of wealth is activity, and of evil its reverse.", source: "Arthashastra, Bk. 1, ch. 19", translation: "trans. Shamasastry" },
      { text: "When a king makes himself inaccessible to his people, he becomes a prey to his enemies.", source: "Arthashastra, Bk. 1, ch. 19", translation: "trans. Shamasastry" },
      { text: "Without his protection the strong will swallow the weak; but under his protection the weak resist the strong.", source: "Arthashastra, Bk. 1, ch. 4", translation: "trans. Shamasastry" },
      { text: "Whoever imposes severe punishment becomes repulsive to the people; while he who awards mild punishment becomes contemptible.", source: "Arthashastra, Bk. 1, ch. 4", translation: "trans. Shamasastry" },
      { text: "Collection of revenue when unripe shall never be carried on, lest the source may be injured.", source: "Arthashastra, Bk. 5, ch. 2", translation: "trans. Shamasastry" },
      { text: "Whoever is superior in power shall wage war; whoever is inferior shall make peace.", source: "Arthashastra, Bk. 7, ch. 1", translation: "trans. Shamasastry" },
    ],
  },

  rosa_luxemburg: {
    pronoun: 'her',
    quotes: [
      { text: "Freedom is always and exclusively freedom for the one who thinks differently.", source: "The Russian Revolution, 1918", translation: "trans. Wolfe" },
      { text: "Freedom only for the supporters of the government, only for the members of one party, is no freedom at all.", source: "The Russian Revolution, 1918", translation: "trans. Wolfe" },
      { text: "Without general elections, without unrestricted freedom of press and assembly, life dies out in every public institution.", source: "The Russian Revolution, 1918", translation: "trans. Wolfe" },
      { text: "Every legal constitution is the product of a revolution.", source: "Reform or Revolution, 1900", translation: "trans. from German" },
      { text: "Bourgeois society stands at the crossroads, either transition to socialism or regression into barbarism.", source: "The Junius Pamphlet, 1915", translation: "trans. from German" },
      { text: "The international proletariat must learn to take its history into its own hands.", source: "The Junius Pamphlet, 1915", translation: "trans. from German" },
      { text: "I was, I am, I shall be!", source: "Order Reigns in Berlin, 1919", translation: "trans. from German" },
    ],
  },

  amartya_sen: {
    pronoun: 'his',
    quotes: [
      { text: "Starvation is the characteristic of some people not having enough food to eat. It is not the characteristic of there being not enough food to eat.", source: "Poverty and Famines, 1981, ch. 1" },
      { text: "The illusion of destiny exacts a remarkably heavy price.", source: "Identity and Violence, 2006" },
      { text: "A solitarist approach can be a good way of misunderstanding nearly everyone in the world.", source: "Identity and Violence, 2006" },
      { text: "Many of the conflicts and barbarities in the world are sustained through the illusion of a unique and choiceless identity.", source: "Identity and Violence, 2006" },
      { text: "Democracy is not a luxury that can await the arrival of general prosperity.", source: "Democracy as a Universal Value, 1999" },
      { text: "A country does not have to be deemed fit for democracy; rather, it has to become fit through democracy.", source: "Democracy as a Universal Value, 1999" },
      { text: "No substantial famine has ever occurred in any independent and democratic country with a relatively free press.", source: "Democracy as a Universal Value, 1999" },
    ],
  },

  john_rawls: {
    pronoun: 'his',
    quotes: [
      { text: "Justice is the first virtue of social institutions, as truth is of systems of thought.", source: "A Theory of Justice, 1971, §1" },
      { text: "Each person possesses an inviolability founded on justice that even the welfare of society as a whole cannot override.", source: "A Theory of Justice, 1971, §1" },
      { text: "Being first virtues of human activities, truth and justice are uncompromising.", source: "A Theory of Justice, 1971, §1" },
      { text: "It may be expedient but it is not just that some should have less in order that others may prosper.", source: "A Theory of Justice, 1971, §3" },
      { text: "Injustice, then, is simply inequalities that are not to the benefit of all.", source: "A Theory of Justice, 1971, §11" },
      { text: "The suppression of liberty is always likely to be irrational.", source: "A Theory of Justice, 1971, §33" },
      { text: "The fault of the utilitarian doctrine is that it mistakes impersonality for impartiality.", source: "A Theory of Justice, 1971, §30" },
      { text: "A just system must generate its own support.", source: "A Theory of Justice, 1971, §41" },
    ],
  },

  deng_xiaoping: {
    pronoun: 'his',
    quotes: [
      { text: "It doesn't matter whether a cat is black or white, as long as it catches mice.", source: "Remark, 1962", translation: "popularized English (orig. Chinese)" },
      { text: "Seeking truth from facts is the basis of the proletarian world outlook as well as the ideological basis of Marxism.", source: "Selected Works, Vol. 2, 1978", translation: "trans. Foreign Languages Press" },
      { text: "The thing to be feared most is silence.", source: "Selected Works, Vol. 2, 1978", translation: "trans. Foreign Languages Press" },
      { text: "Poverty is not socialism.", source: "Selected Works, Vol. 3, 1987", translation: "trans. Foreign Languages Press" },
    ],
  },

  mustafa_kemal_ataturk: {
    pronoun: 'his',
    quotes: [
      { text: "We work for peace at home, peace in the world.", source: "Statement on party policy, 1931", translation: "trans. from Turkish" },
      { text: "Sovereignty belongs unconditionally to the nation.", source: "1921 Constitution, Article 1", translation: "trans. from Turkish" },
      { text: "The strength you need is in the noble blood in your veins!", source: "Address to Turkish Youth (Nutuk), 1927", translation: "trans. from Turkish" },
      { text: "Teachers! The new generation will be your masterpiece.", source: "Address to the Teachers' Union Congress, 1924", translation: "trans. from Turkish" },
    ],
  },

  david_ben_gurion: {
    pronoun: 'his',
    quotes: [
      { text: "If the state does not liquidate the desert, the desert may liquidate the state.", source: "Said at Sde Boker, 1955", translation: "trans. from Hebrew" },
      { text: "The State of Israel will be judged not by its wealth or military strength nor by its technology, but by its moral worth and human values.", source: "The Call of Spirit in Israel, 1951", translation: "trans. from Hebrew" },
      { text: "Without moral and intellectual independence there is no anchor for national independence.", source: "Ben-Gurion Heritage Institute archive", translation: "trans. from Hebrew" },
      { text: "A land can be won by a people only through their own efforts and creativity, their building and settlement.", source: "Article on the Balfour Declaration, 1917", translation: "trans. from Hebrew" },
    ],
  },

  simon_bolivar: {
    pronoun: 'his',
    quotes: [
      { text: "Slavery is the daughter of darkness: an ignorant people is a blind instrument of its own destruction.", source: "Angostura Address, 1819", translation: "trans. from Spanish" },
      { text: "Absolute liberty invariably lapses into absolute power, and the mean between these two extremes is supreme social liberty.", source: "Angostura Address, 1819", translation: "trans. from Spanish" },
      { text: "We need equality to recast, so to speak, into a unified nation, the classes of men, political opinions, and public customs.", source: "Angostura Address, 1819", translation: "trans. from Spanish" },
      { text: "Those who serve a revolution plough the sea.", source: "Attributed (reported c. 1830)", translation: "trans. from Spanish" },
    ],
  },

  elinor_ostrom: {
    pronoun: 'her',
    quotes: [
      { text: "The power of a theory is exactly proportional to the diversity of situations it can explain.", source: "Governing the Commons, 1990" },
      { text: "Hardly a week goes by without a major news story about the threatened destruction of a valuable natural resource.", source: "Governing the Commons, 1990" },
      { text: "'One-size-fits-all' policies are not effective.", source: "Nobel Prize Lecture, 2009" },
    ],
  },

  albert_hirschman: {
    pronoun: 'his',
    quotes: [
      { text: "Most of them have been long on moral indignation and short on irony.", source: "The Rhetoric of Reaction, 1991" },
      { text: "Everything backfires.", source: "The Rhetoric of Reaction, 1991" },
    ],
  },

  raul_prebisch: {
    pronoun: 'his',
    quotes: [
      { text: "In economics, ideologies usually tend either to lag behind events or to outlive them.", source: "The Economic Development of Latin America and Its Principal Problems, 1950", translation: "trans. from Spanish" },
    ],
  },
};

// Look up a member's quote entry by (possibly non-canonical) member name.
// Returns { pronoun, quotes } or null if the member has no corpus yet.
export function getMemberQuotes(name) {
  if (!name) return null;
  return MEMBER_QUOTES[resolveAvatarSlug(slugify(name))] || null;
}
