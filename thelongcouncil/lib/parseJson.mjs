// First complete JSON value (object or array) in a model reply. A greedy
// /\{[\s\S]*\}/ breaks when the model adds a sentence or a second brace after
// the JSON (seen 27 Oct 2026), so walk the candidate end positions instead.
export function parseFirstJson(text, open = '{') {
  const close = open === '[' ? ']' : '}';
  const s = String(text || '');
  const start = s.indexOf(open);
  if (start < 0) return null;
  for (let end = s.indexOf(close, start); end >= 0; end = s.indexOf(close, end + 1)) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch { /* keep extending */ }
  }
  return null;
}
