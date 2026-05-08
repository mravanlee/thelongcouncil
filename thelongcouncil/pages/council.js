import { useState, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export async function getServerSideProps() {
  try {
    const { data: sessions } = await supabase
      .from('sessions')
      .select('member_names');
    const counts = {};
    if (sessions) {
      for (const session of sessions) {
        if (session.member_names) {
          for (const name of session.member_names) {
            const clean = name.replace(/\s*[—–-]\s*(Practitioner|Framer|Wildcard)\s*$/i, '').trim();
            counts[clean] = (counts[clean] || 0) + 1;
          }
        }
      }
    }
    return { props: { debateCounts: counts } };
  } catch (e) {
    return { props: { debateCounts: {} } };
  }
}

function slugify(name) {
  if (!name) return '';
  return name
    .replace(/\s*\([^)]*\)/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function MemberAvatar({ member }) {
  const [imgFailed, setImgFailed] = useState(false);
  const slug = slugify(member.name);
  return (
    <div className="mc-av">
      <span className="mc-av-initials">{member.monogram}</span>
      {!imgFailed && slug && (
        <img
          src={`/avatars/avatar_${slug}.webp`}
          alt=""
          className="mc-av-img"
          onError={() => setImgFailed(true)}
        />
      )}
      <style jsx>{`
        .mc-av { width: 88px; height: 88px; border-radius: 50%; background: #f3eeea; border: 0.5px solid #c8bdb3; flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative; }
        .mc-av-initials { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; font-weight: 600; color: #6b1a1a; letter-spacing: 0.02em; }
        .mc-av-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      `}</style>
    </div>
  );
}

function PositionText({ text, type }) {
  const colonIdx = text.indexOf(':');
  if (colonIdx === -1 || type !== 'thinker') return <span>{text}</span>;
  const concept = text.slice(0, colonIdx);
  const rest = text.slice(colonIdx);
  return <span><span style={{ fontWeight: 500, color: '#6b1a1a' }}>{concept}</span>{rest}</span>;
}

function MemberCard({ member: m, debates }) {
  return (
    <div className="mc-card">
      <div className="mc-top">
        <MemberAvatar member={m} />
        <div className="mc-meta">
          <div className="mc-badge">{m.type === 'leader' ? 'Leader' : 'Thinker'}</div>
          <div className="mc-name">{m.name}</div>
          <div className="mc-role">{m.role}</div>
          <div className="mc-dates">{m.lifespan} · {m.country}</div>
        </div>
      </div>
      <div className="mc-bio">{m.bio}</div>
      <div className="mc-divider" />
      <div className="mc-positions">
        {m.positions.map((p, i) => (
          <div key={i} className="mc-pos">
            <div className="mc-pos-dot" />
            <PositionText text={p} type={m.type} />
          </div>
        ))}
      </div>
      <div className="mc-core">
        <div className="mc-core-label">Core belief</div>
        <div className="mc-core-text">{m.corebelief}</div>
      </div>
      {debates > 0 && (
        <div className="mc-debates">
          <div className="mc-debates-dot" />
          {debates} debates
        </div>
      )}
      <style jsx>{`
        .mc-card { background: #fdfbf6; border: 0.5px solid #d4cfc8; border-top: 2px solid #6b1a1a; border-radius: 2px; padding: 20px; display: flex; flex-direction: column; }
        .mc-top { display: flex; gap: 16px; margin-bottom: 14px; align-items: flex-start; }
        .mc-meta { flex: 1; padding-top: 2px; }
        .mc-badge { display: inline-block; font-family: 'Inter', sans-serif; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #7a7a7a; background: #ede9e2; padding: 3px 8px; border-radius: 2px; margin-bottom: 7px; }
        .mc-name { font-family: 'Playfair Display', Georgia, serif; font-size: 18px; font-weight: 600; color: #0f0f0f; line-height: 1.2; margin: 0 0 3px; }
        .mc-role { font-family: 'Inter', sans-serif; font-size: 12px; color: #4a4a4a; font-style: italic; line-height: 1.4; margin-bottom: 4px; }
        .mc-dates { font-family: 'Inter', sans-serif; font-size: 12px; color: #7a7a7a; }
        .mc-bio { font-family: 'Inter', sans-serif; font-size: 13px; color: #2a2a2a; line-height: 1.65; margin-bottom: 14px; }
        .mc-divider { border: none; border-top: 0.5px solid #e8e3d8; margin-bottom: 12px; }
        .mc-positions { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
        .mc-pos { display: flex; gap: 10px; align-items: flex-start; font-family: 'Inter', sans-serif; font-size: 12.5px; color: #2a2a2a; line-height: 1.55; }
        .mc-pos-dot { width: 14px; height: 1px; background: #6b1a1a; margin-top: 9px; flex-shrink: 0; }
        .mc-core { background: #f0ede3; border-radius: 2px; padding: 10px 13px; margin-bottom: 12px; }
        .mc-core-label { font-family: 'Inter', sans-serif; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #6b1a1a; margin-bottom: 4px; }
        .mc-core-text { font-family: 'Inter', sans-serif; font-size: 12.5px; color: #2a2a2a; line-height: 1.6; font-style: italic; }
        .mc-debates { font-family: 'Inter', sans-serif; font-size: 11px; color: #9a9a9a; display: flex; align-items: center; gap: 5px; margin-top: auto; padding-top: 4px; }
        .mc-debates-dot { width: 5px; height: 5px; border-radius: 50%; background: #6b1a1a; opacity: 0.5; flex-shrink: 0; }
      `}</style>
    </div>
  );
}

const COUNCIL_MEMBERS = [

  // ── LEADERS (alphabetical) ─────────────────────────────────────────────

  { type: 'leader', monogram: 'KA', name: 'Konrad Adenauer', role: 'Chancellor, West Germany 1949–63', lifespan: '* 1876 · † 1967', country: 'West Germany', bio: 'Took over a country in rubble, with twelve years of nazism to answer for and no army, no sovereignty and no money. Bet everything on Western integration when the alternative was permanent occupation. Got it right at 73, and governed until 87.', positions: ['Western integration as security: sovereignty claimed alone is weaker than sovereignty pooled with allies. A vulnerable state needs a structure larger than itself.', 'Economic recovery before democratic consolidation: people who are hungry and humiliated do not make reliable democrats. Deliver prosperity first.', 'Moral reckoning alongside rebuilding: you cannot wait to be forgiven before you start building. Both must happen simultaneously.'], corebelief: 'We all live under the same sky, but we do not all have the same horizon. Extend the horizon first. The rest follows.' },

  { type: 'leader', monogram: 'MKA', name: 'Mustafa Kemal Atatürk', role: 'President, Turkey 1923–38', lifespan: '* 1881 · † 1938', country: 'Turkey', bio: 'Took the ruins of the Ottoman Empire and built a secular republic in eight years. Changed the alphabet, the calendar, the legal code and the dress code. Did it all top-down, without asking permission.', positions: ['Radical transformation over gradualism: when the structure is wrong, reform is not enough. Gradualism preserves what needs to be destroyed.', 'Secularism as precondition: religion as the basis of the state produces a state that cannot adapt. Separate them and you free both.', 'Define the nation by its future, not its past: the Ottoman inheritance was not a foundation to build on. It was a weight to discard.'], corebelief: 'A nation that looks only backward will walk into the future facing the wrong direction. Turn around, and walk forward.' },

  { type: 'leader', monogram: 'BG', name: 'David Ben-Gurion', role: 'Prime Minister, Israel 1948–53; 1955–63', lifespan: '* 1886 · † 1973', country: 'Israel', bio: 'Declared Israeli independence in 1948 with five Arab armies already massing on the border. Simultaneously built a state and fought a war, then resigned twice and came back twice. Understood that survival is not a policy choice but the precondition of all others.', positions: ['Security first: a state without defensible borders cannot govern, cannot plan and cannot promise its citizens anything. Everything else comes after.', 'Build while fighting: institution-building cannot wait for peace. If you wait for peace to build the state, there will be no state when peace arrives.', 'Pragmatic alliances: align with whoever keeps you alive, and be honest with yourself about why. Ideology is a luxury small states cannot afford.'], corebelief: 'Survival is not a policy choice. It is the precondition of all others. A state that forgets this will not last long enough to remember.' },

  { type: 'leader', monogram: 'SB', name: 'Simón Bolívar', role: 'President, Gran Colombia 1819–30', lifespan: '* 1783 · † 1830', country: 'Venezuela', bio: 'Liberated six countries from Spanish rule, then watched them fragment. Died in 1830 convinced he had ploughed the sea. The United States of South America he dreamed of never came. What came instead were the caudillos he had always feared.', positions: ['Liberation is the beginning, not the end: the skills that win independence are not the skills that build a state. The harder work starts the morning after the last battle.', 'Strong executive or fragmentation: post-colonial republics need a strong centre or they dissolve into regional strongmen. Bolívar knew this and could not prevent it.', 'Regional unity or external domination: history offers no stable third option for small states in a world of great powers.'], corebelief: 'Independence without unity is just a change of masters. Building a state that holds together is harder than winning the war and more important.' },

  { type: 'leader', monogram: 'DX', name: 'Deng Xiaoping', role: 'Paramount Leader, China 1978–92', lifespan: '* 1904 · † 1997', country: 'China', bio: 'Purged twice, returned twice. Took over a country wrecked by the Cultural Revolution and turned it into the world\'s fastest-growing economy. No blueprint, no ideology, no apology.', positions: ['Cross the river by feeling the stones: test reforms in one province first, and if they work, scale them. Doctrine kills faster than error.', 'Economic opening with political control: market economies and authoritarian governance can coexist if the sequence is right. China proved it.', 'Absorb, adapt, indigenise: import foreign technology, master it, then make it your own. Dependency ends when you can build it yourself.'], corebelief: 'It does not matter whether the cat is black or white, as long as it catches mice. Results are the only ideology that never fails.' },

  { type: 'leader', monogram: 'IG', name: 'Indira Gandhi', role: 'Prime Minister, India 1966–77; 1980–84', lifespan: '* 1917 · † 1984', country: 'India', bio: 'The only leader in modern democratic history to suspend her own democracy, stand for election, lose, then win again. Governed India through war, famine and separatism. Assassinated by her own bodyguards in 1984.', positions: ['Continental democracy requires centralising authority at moments of crisis. A state that cannot act decisively cannot protect what it claims to govern.', 'Non-alignment is strategic independence, not neutrality. A country of India\'s size cannot afford to be anyone\'s satellite.', 'Poverty elimination justifies state intervention when markets leave the majority behind. Ideology that ignores hunger is not governance.'], corebelief: 'A state that cannot act decisively when it must is not a state. It is an arrangement waiting to fall apart.' },

  { type: 'leader', monogram: 'JNe', name: 'Jawaharlal Nehru', role: 'Prime Minister, India 1947–64', lifespan: '* 1889 · † 1964', country: 'India', bio: 'Built a functioning democracy across 350 million people, fourteen languages and no tradition of central rule. Also founded the non-alignment movement, giving developing countries a way to stay independent from both Washington and Moscow.', positions: ['Institutions before growth: the countries that skipped this step got oligarchs, not citizens.', 'Non-alignment is a strategy, not a posture: staying outside the blocs was the only way to keep options open.', 'Independence without science is incomplete: a country that cannot build what it needs will always depend on those who can.'], corebelief: 'Political freedom is the beginning. Without institutions to protect it and capacity to use it, it does not last a generation.' },

  { type: 'leader', monogram: 'JNy', name: 'Julius Nyerere', role: 'President, Tanzania 1964–85', lifespan: '* 1922 · † 1999', country: 'Tanzania', bio: 'Built African socialism from scratch in Tanzania, watched it fail, and said so publicly. No other African head of state of his generation did that. He stepped down voluntarily. Few of them did that either.', positions: ['Self-reliance is not isolation: it means building the capacity to negotiate as an equal.', 'The international order reproduces poverty: the trade rules, the debt terms, the aid conditions all tilt the same way.', 'Aid that bypasses local institutions destroys them: every time the helper decides, the local decision-maker becomes redundant.'], corebelief: 'We are at war with poverty and ignorance. You do not win that war by waiting for better conditions.' },

  { type: 'leader', monogram: 'LKY', name: 'Lee Kuan Yew', role: 'Prime Minister, Singapore 1959–90', lifespan: '* 1923 · † 2015', country: 'Singapore', bio: 'Took over a city with no hinterland, no resources and four languages that did not get along. Built one of the wealthiest states in the world by deciding what mattered and refusing to apologise for the rest. The argument about whether it was democracy never stopped.', positions: ['Resilience over optimism: design policy for the worst case, not the most likely. Small states that plan for good outcomes are surprised by bad ones.', 'Meritocracy as non-negotiable: a state that rewards the wrong people for the wrong reasons will be governed by the wrong people. The pipeline from school to government must select on ability.', 'Small state survival through usefulness: neutrality is not a strategy. Make yourself indispensable to your neighbours and you are harder to ignore.'], corebelief: 'A small state that is not useful to its neighbours will not survive them. Usefulness is not weakness. It is the only strategy that works.' },

  { type: 'leader', monogram: 'MM', name: 'Mahathir Mohamad', role: 'Prime Minister, Malaysia 1981–2003', lifespan: '* 1925', country: 'Malaysia', bio: 'Governed Malaysia for 22 years, modernised it, then came back at 92 to govern it again. Rejected IMF conditions during the 1997 Asian financial crisis and imposed capital controls instead. The IMF said it would be catastrophic. It was not.', positions: ['Reject orthodoxy when it conflicts with national interest: what works in Washington does not automatically work in Kuala Lumpur. Know the difference.', 'Industrial policy works in early development: markets left alone do not always build the industries a developing country needs. State direction can fill the gap.', 'Monetary sovereignty is non-negotiable: a country that cannot control its own currency cannot control its own economy. The 1997 crisis proved it.'], corebelief: 'Development is not a gift from richer countries. It is something you build yourself, on your own terms, even when they tell you it cannot be done that way.' },

  { type: 'leader', monogram: 'NM', name: 'Nelson Mandela', role: 'President, South Africa 1994–99', lifespan: '* 1918 · † 2013', country: 'South Africa', bio: '27 years in prison. Walked out and chose reconciliation over retribution when no one would have blamed him for the alternative. Handed power over peacefully four years later.', positions: ['Retribution feels like justice but functions like destruction: a country that settles scores cannot build anything.', 'Moral authority is leverage: it changes what is politically possible in ways that force cannot.', 'Governance capacity before redistribution: a state that cannot deliver services cannot redistribute anything that stays redistributed.'], corebelief: 'Resentment is a prison you build for yourself. The man who walks out is the only one free enough to build something new.' },

  { type: 'leader', monogram: 'OP', name: 'Olof Palme', role: 'Prime Minister, Sweden 1969–76; 1982–86', lifespan: '* 1927 · † 1986', country: 'Sweden', bio: 'Led Sweden to take clear positions on Vietnam, apartheid and nuclear weapons when it would have been easier to stay quiet. Showed that a small country with no military power could still matter in world politics, if it was consistent enough.', positions: ['Security is not zero-sum: building safety at your neighbour\'s expense creates the next conflict. The adversary must also feel secure or the arrangement will not hold.', 'A small state\'s only currency is consistency: one exception and the credibility is gone. There is no rebuilding it.', 'Equality and efficiency reinforce each other: the trade-off is smaller than its opponents need it to be.'], corebelief: 'A small country cannot project military power. It can project moral consistency. That turns out to be worth more.' },

  { type: 'leader', monogram: 'FDR', name: 'Franklin D. Roosevelt', role: 'President, United States 1933–45', lifespan: '* 1882 · † 1945', country: 'United States', bio: 'Took office with banks failing and a quarter of the workforce unemployed. Closed every bank in the country for four days, reopened them with government backing, and told Americans it was safe. Most of them believed him.', positions: ['Government must act when markets cannot: waiting for self-correction is itself a choice, with consequences.', 'Build the broadest coalition before committing: a reform that only half the country accepts will be reversed by the other half.', 'Relief, recovery and reform run simultaneously: the political window for radical change does not stay open while you sequence.'], corebelief: 'The only thing to fear is inaction dressed up as prudence. A government that explains why it cannot move has already decided not to.' },

  { type: 'leader', monogram: 'HS', name: 'Helmut Schmidt', role: 'Chancellor, West Germany 1974–82', lifespan: '* 1918 · † 2015', country: 'West Germany', bio: 'Governed West Germany during the oil shock, RAF terrorism and the NATO dual-track debate simultaneously. Made enemies in his own party enforcing decisions he knew were unpopular. A leader who avoids the hard choice, he said, has already failed.', positions: ['Energy dependence is a sovereignty question: a country that cannot power itself cannot govern itself. Schmidt learned this during the 1973 oil embargo and never forgot it.', 'Crisis demands simultaneous action: sequencing is a luxury that belongs to peacetime. In a crisis, everything must happen at once or nothing works.', 'Never eliminate your last emergency option: the leader who has no fallback has already lost control of events.'], corebelief: 'A leader who waits for perfect information before deciding has already decided to let events decide for him.' },

  { type: 'leader', monogram: 'EJS', name: 'Ellen Johnson Sirleaf', role: 'President, Liberia 2006–18', lifespan: '* 1938', country: 'Liberia', bio: 'Took power in Liberia after a civil war that had destroyed almost every institution. Built international credibility fast, established working government from scratch, and stepped down when her term ended. The first female head of state in African history.', positions: ['Credibility is the first currency of post-conflict recovery: without it, no investment, no aid, no reform holds.', 'Women\'s participation is not a moral argument: every country that excluded women from economic life left growth on the table.', 'You cannot skip the sequence: security, then institutions, then development. The step you skip comes back.'], corebelief: 'Rebuilding a broken state is a political problem, not a humanitarian one. Get the politics wrong and the rest is wasted.' },

  { type: 'leader', monogram: 'MT', name: 'Margaret Thatcher', role: 'Prime Minister, United Kingdom 1979–90', lifespan: '* 1925 · † 2013', country: 'United Kingdom', bio: 'Came to power when Britain was ungovernable. Three-day weeks, rubbish in the streets, the IMF at the door. Broke the unions, privatised the utilities, rewrote the rules of the British state. She did not seek consensus. She thought consensus was the problem.', positions: ['The state crowds out private initiative: reducing its scope is not a policy preference but the precondition of growth.', 'Property rights and rule of law are non-negotiable. Everything else can be debated.', 'A country that cannot power itself cannot govern itself. Energy is sovereignty.'], corebelief: 'The market is not perfect. But a government that thinks it can do better has not been paying attention to governments.' },

  // ── THINKERS (alphabetical) ────────────────────────────────────────────

  { type: 'thinker', monogram: 'AH', name: 'Albert Hirschman', role: 'Economist · Exit, Voice and Loyalty', lifespan: '* 1915 · † 2012', country: 'Germany / USA', bio: 'The ultimate optimist in a field full of gloom. Fled the Nazis, fought in Spain, reinvented himself in Latin America. Concluded that disorder is not an obstacle to development but its engine.', positions: ['Unbalanced growth: progress comes from tension between sectors, not from everything working smoothly at once.', 'The hiding hand: before starting a project, we underestimate both its difficulties and our ability to overcome them. That gap is what makes progress possible.', 'Exit, voice, loyalty: when an institution fails, people either leave, complain, or stay silent. Which option they choose determines whether the institution improves or collapses.'], corebelief: 'Stop trying to control everything. The creativity that solves the problem emerges from the chaos of attempting it.' },

  { type: 'thinker', monogram: 'AA', name: 'Ali ibn Abi Talib', role: 'Fourth Caliph of Islam · Letter to Malik al-Ashtar', lifespan: '* 601 · † 661', country: 'Arabia', bio: 'Cousin and son-in-law of the Prophet, fourth Caliph of Islam. His letter to the governor of Egypt remains one of history\'s most sophisticated texts on the obligations of those who hold power. Assassinated in 661. His death split Islam into Sunni and Shia.', positions: ['Justice before stability: a ruler who maintains order through injustice has not solved the problem but postponed it.', 'Fair taxation: tax the people according to what the land produces, not according to what you need. Greed destroys the prosperity it tries to extract.', 'Judicial independence: if the judge fears the ruler, there is no justice. The test of governance is whether the powerful can be held to account.'], corebelief: 'The ruler who governs for himself will lose everything. The ruler who governs for his people might keep it.' },

  { type: 'thinker', monogram: 'AS', name: 'Amartya Sen', role: 'Economist · Development as Freedom', lifespan: '* 1933', country: 'India / UK', bio: 'Watched people starve in Bengal as a child, not because there was no food but because they had no money to buy it. Spent the rest of his life proving that poverty is a political failure, not a natural condition. No functioning democracy with a free press has ever had a famine. He proved that.', positions: ['The capability approach: development means expanding what people can actually do and be, not just raising their incomes. GDP misses most of what matters.', 'Famines and democracy: famines happen when governments have no incentive to prevent them. Give people a free press and a vote, and governments find the incentive fast.', 'Women\'s education: educate women and everything else improves. It is the highest-return investment in development.'], corebelief: 'Poverty is not a natural condition. It is a political failure and political failures can be corrected.' },

  { type: 'thinker', monogram: '孔', name: 'Confucius', role: 'Philosopher · The Analects', lifespan: '* 551 BC · † 479 BC', country: 'China', bio: 'Spent decades trying to persuade rulers to govern morally. None of them listened. He died believing he had failed. Two and a half thousand years later his ideas still shape how a third of the world thinks about authority, merit and obligation.', positions: ['Rectification of names: when rulers call things what they are not, thought becomes confused and governance follows. Clarity of language is the foundation of good governance.', 'Meritocracy: authority should come from ability and character, not birth or wealth. Reward the wrong people and you will be governed by the wrong people.', 'The ruler\'s obligation: the people\'s trust is the only thing a ruler cannot afford to lose. Armies and wealth can be rebuilt. Trust, once gone, is gone.'], corebelief: 'Govern yourself before you govern others. Moral authority is not a luxury. It is the only authority that lasts.' },

  { type: 'thinker', monogram: 'ER', name: 'Eleanor Roosevelt', role: 'Human rights architect · Universal Declaration of Human Rights', lifespan: '* 1884 · † 1962', country: 'United States', bio: 'Had no elected office and more influence than most heads of state. Drove the Universal Declaration of Human Rights through eighteen governments who agreed on almost nothing, then spent the rest of her life pointing out that rights without enforcement are just words.', positions: ['A right you cannot claim is not a right: the stateless have no court, no government, nothing to appeal to.', 'Economic rights belong on the same list: the right to eat is not softer than the right to speak.', 'Moral authority without power has a ceiling: institutions move governments further than persuasion does.'], corebelief: 'Declarations are easy. Building something that forces governments to honour them is the actual work.' },

  { type: 'thinker', monogram: 'EO', name: 'Elinor Ostrom', role: 'Economist · Governing the Commons', lifespan: '* 1933 · † 2012', country: 'United States', bio: 'Spent her career studying fishing villages, forests and irrigation canals to test the idea that communities can govern shared resources without privatisation or state control. They can, and often better. Won the Nobel Prize in Economics in 2009, the first woman to do so.', positions: ['The commons: fishing villages, forests and irrigation canals can be governed collectively by the communities that depend on them, often more effectively than by markets or states.', 'Polycentric governance: no single structure fits all situations. A village water system and a national electricity grid need different rules. Standardising them destroys what makes each work.', 'Local knowledge: the farmer who has worked the same land for thirty years knows things no central planner ever will. That knowledge is the most valuable input to governance design.'], corebelief: 'Neither the market nor the state has a monopoly on good governance. Communities can solve what both fail to fix.' },

  { type: 'thinker', monogram: 'FF', name: 'Frantz Fanon', role: 'Philosopher · The Wretched of the Earth', lifespan: '* 1925 · † 1961', country: 'Martinique / Algeria', bio: 'The first thinker to argue that colonialism damages the minds of the colonised as much as their economies. That insight explained why so many independence movements produced governments that behaved just like the colonial powers they replaced. He wrote it in 1961. It still holds.', positions: ['Colonialism colonises the mind: political independence without undoing that produces leaders who govern like the people they replaced.', 'The flag changes, the structure stays: inheriting colonial institutions means inheriting colonial logic.', 'Watch who takes the keys: the national bourgeoisie typically serves the same interests in different clothing.'], corebelief: 'Liberation that stops at the border crossing is not liberation. The deeper occupation is in the mind.' },

  { type: 'thinker', monogram: 'FH', name: 'Friedrich Hayek', role: 'Economist · The Road to Serfdom', lifespan: '* 1899 · † 1992', country: 'Austria / UK', bio: 'Wrote The Road to Serfdom in 1944 when everyone assumed central planning was the future. Got laughed at for thirty years. Then stagflation hit, the planned economies collapsed, and nobody was laughing.', positions: ['The knowledge problem: prices aggregate the dispersed, local knowledge of millions of people simultaneously. No central planner can replicate that. Planning always knows less than it thinks it does.', 'Spontaneous order: the institutions that work best were not designed. They emerged from voluntary exchange over long periods of time. Designing them from scratch destroys what makes them function.', 'The road to serfdom: economic planning requires political control to enforce it. The two cannot be separated. That is how good intentions become tyranny.'], corebelief: 'The market knows things no planner ever will. Ignore that and you do not just fail economically. You build the road to something worse.' },

  { type: 'thinker', monogram: 'HA', name: 'Hannah Arendt', role: 'Philosopher · The Origins of Totalitarianism', lifespan: '* 1906 · † 1975', country: 'Germany / USA', bio: 'Fled Nazi Germany, spent 18 years stateless, reported on the Eichmann trial and concluded that the greatest evil is not committed by monsters but by bureaucrats who stop thinking.', positions: ['The banality of evil: atrocity does not require monsters. It requires ordinary people following orders without moral judgment. Thinking is a political act.', 'Power and violence: power comes from people acting together. Violence can destroy power but cannot create it. A regime that rules by violence alone has already lost.', 'The public realm: politics requires a shared space where citizens act and are seen. When that space is eliminated, what remains is administration, not governance.'], corebelief: 'Stop thinking and you become an instrument of whatever system surrounds you. That is how ordinary people do extraordinary harm.' },

  { type: 'thinker', monogram: 'IK', name: 'Ibn Khaldun', role: 'Historian · The Muqaddimah', lifespan: '* 1332 · † 1406', country: 'North Africa', bio: 'Born in Tunis, served courts across North Africa and Iberia, negotiated with Tamerlane outside Damascus in 1401 and survived. Along the way wrote the first systematic theory of why civilisations rise and fall.', positions: ['Asabiyya: the Arabic term for social cohesion. It is the engine of political power. When it erodes, the state follows.', 'The cycle of dynasties: every ruling group plants the seeds of its own decay. Success breeds comfort, comfort erodes the discipline that produced success. The cycle repeats without exception.', 'Taxation theory: tax moderately and prosperity grows, giving you more to tax. Tax heavily and you destroy the base. Ibn Khaldun described the Laffer curve six centuries before Laffer.'], corebelief: 'The past resembles the future more than water resembles water. Human nature does not change. Only the costumes do.' },

  { type: 'thinker', monogram: 'JJR', name: 'Jean-Jacques Rousseau', role: 'Philosopher · The Social Contract', lifespan: '* 1712 · † 1778', country: 'France / Geneva', bio: 'Argued that inequality is not natural. Property, law and social convention created it, and what humans created they can change. That single idea runs through almost every left-wing political movement that came after him.', positions: ['The general will is not a vote: what a community needs is not always what its members want. That gap is where Rousseau lives.', 'Inequality was invented: property created it, law entrenched it, habit made it feel natural. None of it is inevitable.', 'Legitimate authority requires total consent: a law some obey only because they have no choice is coercion with better paperwork.'], corebelief: 'Society produces human nature, not the other way around. Get the society wrong and everything else follows.' },

  { type: 'thinker', monogram: 'JL', name: 'John Locke', role: 'Philosopher · Two Treatises of Government', lifespan: '* 1632 · † 1704', country: 'England', bio: 'Wrote the case for liberal democracy while in exile before any of it was law: government by consent, natural rights, the right to remove rulers who violate them. The American founders read him so closely that the Declaration of Independence reads like a summary.', positions: ['Consent is not optional: a ruler who governs without consent is not a government. He is an occupation that has not yet been challenged.', 'Rights exist before the state, not because of it: life, liberty and property are not gifts from governments. Governments exist to protect them.', 'Revolution is an obligation, not a last resort: a government that systematically violates natural rights has broken the contract. Replacement is the only legitimate response.'], corebelief: 'Power that cannot justify itself by what it protects has no claim to obedience. That is not radical. It is the only thing that makes government legitimate.' },

  { type: 'thinker', monogram: 'JMK', name: 'John Maynard Keynes', role: 'Economist · The General Theory', lifespan: '* 1883 · † 1946', country: 'United Kingdom', bio: 'Attended the Paris Peace Conference in 1919, concluded the reparations terms would destroy Germany, resigned in protest and wrote a book predicting exactly what followed. Was ignored. Spent the next twenty years developing an economics that could prevent it happening again.', positions: ['Aggregate demand: when private spending collapses in a recession, public spending must fill the gap. Left alone, economies do not self-correct. They spiral.', 'The paradox of thrift: saving is rational for one household in hard times. When every household does it simultaneously, spending collapses and everyone gets poorer. Individual logic, collective catastrophe.', 'Uncertainty: we do not know the future. Under genuine uncertainty, insure against the worst case, not just the most likely one.'], corebelief: 'In the long run we are all dead. Policy must solve present problems with present tools. Not wait for a future the present has already foreclosed.' },

  { type: 'thinker', monogram: 'JR', name: 'John Rawls', role: 'Philosopher · A Theory of Justice', lifespan: '* 1921 · † 2002', country: 'United States', bio: 'Asked one devastatingly simple question: what kind of society would you design if you did not know where you would end up inside it? Rich or poor, healthy or sick, powerful or forgotten. That thought experiment gave liberal democracy a moral foundation it had never had before.', positions: ['The veil of ignorance cuts through self-interest: design policy before knowing if you will be born rich or poor. Your choices look different from behind that veil.', 'Inequality must earn its place: only justified when it makes the worst-off better off. Growth that widens the gap while leaving the bottom behind fails the test.', 'Justice is not a reward for prosperity: a society that plans to be fair once it is rich enough will never be fair.'], corebelief: 'The comfortable design systems that serve the comfortable. Design from behind the veil and you break that loop.' },

  { type: 'thinker', monogram: 'KT', name: 'Kautilya', role: 'Statesman · The Arthashastra', lifespan: '* 350 BC · † 283 BC', country: 'India', bio: 'Chief minister to the founder of the Maurya Empire, the largest state the Indian subcontinent had seen. Wrote the Arthashastra: a complete manual of statecraft covering espionage, taxation, trade and governance. Machiavelli gets the credit. Kautilya got there 1,800 years earlier.', positions: ['The welfare state: the welfare of the ruler is in the welfare of the subjects. A state that extracts from its people rather than building their capacity will not last.', 'Enemy of my enemy: foreign policy is the art of identifying your adversary\'s adversary and turning him into your ally. Sentiment has no place in this calculation.', 'The treasury: a state without revenue is a state without spine. Defence, justice and welfare all depend on a functioning treasury. Everything starts there.'], corebelief: 'The king who is energetic and wise prospers. The king who is energetic and unwise destroys himself. The king who is neither destroys his people.' },

  { type: 'thinker', monogram: 'MF', name: 'Milton Friedman', role: 'Economist · Capitalism and Freedom', lifespan: '* 1912 · † 2006', country: 'United States', bio: 'Told anyone who would listen for thirty years that inflation is always and everywhere a monetary phenomenon. Governments ignored him until the 1970s, when inflation hit and they ran out of alternatives.', positions: ['Monetarism: inflation comes from too much money chasing too few goods. Control the money supply and you control inflation. Everything else is a distraction.', 'Economic and political freedom: restrict economic freedom and political freedom follows. The two cannot be separated for long.', 'Government failure: government programs rarely solve the problems they are designed to fix. They create constituencies for their own continuation instead.'], corebelief: 'The market is imperfect. Government is also imperfect. The difference is that market mistakes are corrected by competition. Government mistakes are entrenched by politics.' },

  { type: 'thinker', monogram: 'NMa', name: 'Niccolo Machiavelli', role: 'Statesman · The Prince', lifespan: '* 1469 · † 1527', country: 'Florence', bio: 'Served the Florentine Republic loyally for 14 years, was tortured after the Medici returned to power, and retired to write the books that made him famous. The Prince was a job application that never worked. He died without the political career he spent his life trying to restore.', positions: ['Effective power over moral power: the question is not whether force is just. It is whether it is effective. A ruler who is only good will be destroyed by those who are not.', 'Strategic patience: timing is everything. Strike at the right moment, not the righteous one. A prince who cannot see three moves ahead is not strategically serious.', 'Fear over love: it is better to be feared than loved when you cannot be both. But it is fatal to be hated. The space between fear and hatred is where power lives.'], corebelief: 'Everyone sees what you appear to be. Few experience what you really are. In politics, appearances are not a distraction from reality. They are part of it.' },

  { type: 'thinker', monogram: 'RP', name: 'Raúl Prebisch', role: 'Economist · Dependency Theory', lifespan: '* 1901 · † 1986', country: 'Argentina', bio: 'Ran Argentina\'s central bank and spent decades watching the same pattern: poor countries export raw materials, rich countries sell them back as finished goods. He named that mechanism and gave the developing world a way to understand why free trade was not working in their favour.', positions: ['The terms of trade are a trap: commodity prices fall over time relative to manufactured goods. Free trade locks in who is ahead.', 'Industrialise or stay dependent: you cannot develop by selling what richer countries need. Build your own capacity, then compete.', 'The playing field was designed by those already winning: the global trading system reflects the interests of those who built it.'], corebelief: 'The invisible hand works beautifully for countries already ahead. For everyone else, it locks in the starting position.' },

  { type: 'thinker', monogram: 'RL', name: 'Rosa Luxemburg', role: 'Revolutionary theorist · The Accumulation of Capital', lifespan: '* 1871 · † 1919', country: 'Poland / Germany', bio: 'Argued that a socialist revolution that silences its critics will end up oppressing everyone. She wrote that before the Soviet Union existed to prove her right. Almost no one on the left listened. History did.', positions: ['Socialism without freedom is a different kind of cage: a revolution that suppresses dissent to achieve equality will end by suppressing both.', 'Capitalism must expand or die: when it runs out of new markets, it manufactures war. Imperialism is not foreign policy. It is economic necessity.', 'Revolution cannot be commanded: it rises from workers acting together, not from a vanguard deciding for them.'], corebelief: 'Freedom is only real for the person who thinks differently. A socialism that cannot tolerate dissent has already failed the test.' },

  { type: 'thinker', monogram: 'ST', name: 'Sun Tzu', role: 'Strategist · The Art of War', lifespan: '* 544 BC · † 496 BC', country: 'China', bio: 'May or may not have existed as a single person. The Art of War almost certainly did not come from one hand. None of that has mattered. Fifteen centuries of generals and every business school in the world have found it indispensable.', positions: ['Supreme strategy: the highest form of strategy is to defeat the adversary without fighting. Force is expensive, slow and produces enemies. Win before the battle begins.', 'Know yourself and your enemy: the commander who does not know his own weaknesses or his enemy\'s strengths loses every battle, however large his army.', 'Deception as strategy: appear weak when strong, strong when weak. The adversary who misreads you has already lost.'], corebelief: 'The general who wins the battle has already won it in his mind before it is fought. The general who loses has fought first and sought victory afterwards.' },

  { type: 'thinker', monogram: 'WM', name: 'Wangari Maathai', role: 'Political ecologist · The Green Belt Movement', lifespan: '* 1940 · † 2011', country: 'Kenya', bio: 'Founded the Green Belt Movement in Kenya and planted 30 million trees by organising rural women to do it. Jailed repeatedly by the government for her activism. Won the Nobel Peace Prize in 2004, the first African woman to do so.', positions: ['Deforestation is a governance failure: when women walked further each year for firewood, the cause was who controlled the land and for whose benefit.', 'Communities protect what they govern: move ownership to the state or a corporation and the incentive to protect disappears.', 'Women are not a social issue: in most of Africa, women manage water, food and fuel daily. Exclude them and the decisions will be wrong.'], corebelief: 'A government that degrades its land is degrading its people. The two cannot be separated.' },

];

export default function Council({ debateCounts = {} }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => ({
    all: COUNCIL_MEMBERS.length,
    leader: COUNCIL_MEMBERS.filter(m => m.type === 'leader').length,
    thinker: COUNCIL_MEMBERS.filter(m => m.type === 'thinker').length,
  }), []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return COUNCIL_MEMBERS.filter(m => {
      if (filter !== 'all' && m.type !== filter) return false;
      if (!q) return true;
      return `${m.name} ${m.role} ${m.country}`.toLowerCase().includes(q);
    });
  }, [filter, search]);

  const visibleLeaders = visible.filter(m => m.type === 'leader');
  const visibleThinkers = visible.filter(m => m.type === 'thinker');

  return (
    <>
      <Head>
        <title>The Council — The Long Council</title>
        <meta name="description" content="37 historic leaders and thinkers who form The Long Council — from Machiavelli to Mandela, Keynes to Sun Tzu." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="The Council — The Long Council" />
        <meta property="og:description" content="37 historic leaders and thinkers who form The Long Council — from Machiavelli to Mandela, Keynes to Sun Tzu." />
        <meta property="og:url" content="https://www.thelongcouncil.com/council" />
        <meta property="og:image" content="https://www.thelongcouncil.com/og-default.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="The Long Council — History's counsel on today's questions" />
        <meta property="og:site_name" content="The Long Council" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="The Council — The Long Council" />
        <meta name="twitter:description" content="37 historic leaders and thinkers who form The Long Council — from Machiavelli to Mandela, Keynes to Sun Tzu." />
        <meta name="twitter:image" content="https://www.thelongcouncil.com/og-default.png" />
      </Head>

      <Link href="/" className="mast mast-link">
        <div className="mast-name">The Long Council</div>
        <div className="mast-tag">History&apos;s counsel on today&apos;s questions</div>
      </Link>

      <nav className="nav">
        <Link href="/council" className="nav-link nav-active">The Council</Link>
        <Link href="/archive" className="nav-link">The Archive</Link>
        <Link href="/about" className="nav-link">About</Link>
        <Link href="/" className="nav-raise">Raise an issue</Link>
      </nav>

      <div className="council-hd">
        <h2>The Council</h2>
        <p>37 leaders and thinkers, selected for the depth and specificity of their documented record. Together they form the deliberative body — drawn from different centuries, continents and traditions.</p>
        <div className="council-filters">
          <button className={`cf ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>All — {counts.all}</button>
          <button className={`cf ${filter === 'leader' ? 'on' : ''}`} onClick={() => setFilter('leader')}>Leaders — {counts.leader}</button>
          <button className={`cf ${filter === 'thinker' ? 'on' : ''}`} onClick={() => setFilter('thinker')}>Thinkers — {counts.thinker}</button>
          <input className="council-search" type="text" placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {visibleLeaders.length > 0 && (
        <>
          <div className="council-section-label">Leaders</div>
          <div className="council-grid">
            {visibleLeaders.map(m => <MemberCard key={m.name} member={m} debates={debateCounts[m.name] || 0} />)}
          </div>
        </>
      )}

      {visibleThinkers.length > 0 && (
        <>
          <div className="council-section-label">Thinkers</div>
          <div className="council-grid">
            {visibleThinkers.map(m => <MemberCard key={m.name} member={m} debates={debateCounts[m.name] || 0} />)}
          </div>
        </>
      )}

      {visible.length === 0 && <div className="council-empty">No members match your search.</div>}

      <footer>The Long Council · Counsel from history&apos;s greatest minds, brought to life by AI</footer>

      <style jsx>{`
        .council-hd { max-width: 680px; margin: 2.5rem auto 0; padding: 0 1.25rem; }
        .council-hd h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 600; color: #0f0f0f; margin: 0 0 0.75rem; }
        .council-hd p { font-family: 'Inter', sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.65; margin: 0 0 1.5rem; }
        .council-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .cf { font-family: 'Inter', sans-serif; font-size: 12px; padding: 6px 14px; border-radius: 2px; border: 0.5px solid #c8bdb3; background: transparent; color: #4a4a4a; cursor: pointer; letter-spacing: 0.02em; transition: background 0.15s, color 0.15s; }
        .cf:hover { border-color: #9a8f86; }
        .cf.on { background: #0f0f0f; color: #f8f6f2; border-color: #0f0f0f; }
        .council-search { font-family: 'Inter', sans-serif; font-size: 13px; padding: 6px 12px; border: 0.5px solid #c8bdb3; background: #f3eeea; border-radius: 2px; color: #1a1a1a; outline: none; margin-left: auto; width: 180px; }
        .council-search:focus { border-color: #6b1a1a; }
        .council-section-label { max-width: 1160px; margin: 2.5rem auto 1rem; padding: 0 1.25rem 8px; font-family: 'Inter', sans-serif; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #9a9a9a; border-bottom: 0.5px solid #d4cfc8; }
        .council-grid { max-width: 1160px; margin: 0 auto; padding: 0 1.25rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
        .council-empty { max-width: 680px; margin: 3rem auto; padding: 0 1.25rem; font-family: 'Inter', sans-serif; font-size: 14px; color: #9a9a9a; text-align: center; }
        @media (max-width: 480px) { .council-search { width: 100%; margin-left: 0; } }
      `}</style>
    </>
  );
}
