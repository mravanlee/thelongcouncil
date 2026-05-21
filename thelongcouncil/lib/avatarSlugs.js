// Shared avatar slug resolution.
//
// Why this exists: the council pipeline occasionally produces a member name
// that differs slightly from the canonical roster form (e.g. AI writes
// "Albert O. Hirschman" when the canonical is "Albert Hirschman"). The
// per-file slugify functions then produce a slug ("albert_o_hirschman")
// that does not match any file in /public/avatars, the image 404s and
// the monogram fallback is shown.
//
// This module exposes:
//   - AVATAR_NAME_EXPANSIONS: short-form → canonical slug map (legacy lookups).
//   - KNOWN_AVATAR_SLUGS: the set of slugs that actually have an asset on disk.
//   - resolveAvatarSlug(naiveSlug): exact match → expansion lookup → fuzzy
//     last-name match against KNOWN_AVATAR_SLUGS → fallback to the naive slug.
//
// Rendering, sizes and styles stay in each calling component — this module
// only resolves the slug string.

export const AVATAR_NAME_EXPANSIONS = {
  'machiavelli': 'niccolo_machiavelli',
  'keynes': 'john_maynard_keynes',
  'hayek': 'friedrich_hayek',
  'friedman': 'milton_friedman',
  'locke': 'john_locke',
  'rousseau': 'jean_jacques_rousseau',
  'rawls': 'john_rawls',
  'arendt': 'hannah_arendt',
  'sen': 'amartya_sen',
  'hirschman': 'albert_hirschman',
  'fanon': 'frantz_fanon',
  'prebisch': 'raul_prebisch',
  'ostrom': 'elinor_ostrom',
  'bolivar': 'simon_bolivar',
};

// Auto-generated from /public/avatars/*.webp on 2026-05-21. Update this list
// when avatars are added or removed. (A build-time validator can be added
// later — see open todos in project_long_council_strategic_redesign memory.)
export const KNOWN_AVATAR_SLUGS = new Set([
  'albert_hirschman',
  'ali_ibn_abi_talib',
  'amartya_sen',
  'confucius',
  'david_ben_gurion',
  'deng_xiaoping',
  'eleanor_roosevelt',
  'elinor_ostrom',
  'ellen_johnson_sirleaf',
  'franklin_d_roosevelt',
  'frantz_fanon',
  'friedrich_hayek',
  'hannah_arendt',
  'helmut_schmidt',
  'ibn_khaldun',
  'indira_gandhi',
  'jawaharlal_nehru',
  'jean_jacques_rousseau',
  'john_locke',
  'john_maynard_keynes',
  'john_rawls',
  'julius_nyerere',
  'kautilya',
  'konrad_adenauer',
  'lee_kuan_yew',
  'mahathir_mohamad',
  'margaret_thatcher',
  'milton_friedman',
  'mustafa_kemal_ataturk',
  'nelson_mandela',
  'niccolo_machiavelli',
  'olof_palme',
  'raul_prebisch',
  'rosa_luxemburg',
  'simon_bolivar',
  'sun_tzu',
  'wangari_maathai',
]);

/**
 * Resolve a naive (just-computed) slug to a slug that actually has an avatar
 * file on disk. Falls back to last-name fuzzy match before returning the naive
 * slug as-is (which will then 404 and render the monogram).
 *
 * @param {string} naiveSlug e.g. "albert_o_hirschman"
 * @returns {string} resolved slug, e.g. "albert_hirschman"
 */
export function resolveAvatarSlug(naiveSlug) {
  if (!naiveSlug) return '';

  // 1. Exact match — slug already corresponds to a known file.
  if (KNOWN_AVATAR_SLUGS.has(naiveSlug)) return naiveSlug;

  // 2. Legacy expansion map (handles short-form names like "machiavelli").
  if (AVATAR_NAME_EXPANSIONS[naiveSlug]) return AVATAR_NAME_EXPANSIONS[naiveSlug];

  // 3. Fuzzy: last-token (typically last name) match against known slugs.
  //    Catches cases like AI emitting "Albert O. Hirschman" — naive slug
  //    "albert_o_hirschman", last token "hirschman", matches "albert_hirschman".
  const tokens = naiveSlug.split('_').filter(Boolean);
  if (tokens.length > 0) {
    const last = tokens[tokens.length - 1];
    const candidates = [];
    for (const known of KNOWN_AVATAR_SLUGS) {
      const knownTokens = known.split('_');
      if (knownTokens[knownTokens.length - 1] === last) candidates.push(known);
    }
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      // Multiple candidates sharing last name (rare). Prefer the one whose
      // token-set best matches the input.
      let best = candidates[0];
      let bestScore = -1;
      for (const cand of candidates) {
        const candTokens = cand.split('_');
        const shared = tokens.filter(t => candTokens.includes(t)).length;
        if (shared > bestScore) { bestScore = shared; best = cand; }
      }
      return best;
    }
  }

  // 4. Nothing matched — return the naive slug; the <img onError> will catch
  //    the 404 and render the monogram fallback.
  return naiveSlug;
}
