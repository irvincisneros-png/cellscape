// The year-level lens: one setting that adjusts vocabulary, depth, missions and quizzes.
// Content can be written as { "y7-8": "...", "y9-10": "...", "y11": "...", "y12": "..." } —
// pick() returns the most detailed variant at or below the current band.

export const BANDS = [
  { id: "y7-8", label: "Years 7–8", short: "Y7–8" },
  { id: "y9-10", label: "Years 9–10", short: "Y9–10" },
  { id: "y11", label: "Year 11 Biology", short: "Y11" },
  { id: "y12", label: "Year 12 Biology", short: "Y12" },
];
const ORDER = BANDS.map((b) => b.id);
const KEY = "cellscape.lens";

let current = "y9-10";
try {
  const q = new URLSearchParams(location.search).get("year");
  const fromQ = q && ORDER.find((b) => b.startsWith(q.replace(/^y?/, "y")));
  current = fromQ || localStorage.getItem(KEY) || current;
  if (!ORDER.includes(current)) current = "y9-10";
} catch { /* storage blocked: keep default */ }

const subs = new Set();

export const lens = {
  get band() { return current; },
  get index() { return ORDER.indexOf(current); },
  set(band) {
    if (!ORDER.includes(band) || band === current) return;
    current = band;
    try { localStorage.setItem(KEY, band); } catch { /* ignore */ }
    for (const f of subs) f(band);
  },
  /** true if the current band is at least `band` */
  atLeast(band) { return ORDER.indexOf(current) >= ORDER.indexOf(band); },
  /** choose the most detailed variant available at or below the current band */
  pick(v) {
    if (v == null || typeof v !== "object" || Array.isArray(v)) return v;
    for (let i = ORDER.indexOf(current); i >= 0; i--) if (v[ORDER[i]] != null) return v[ORDER[i]];
    for (const b of ORDER) if (v[b] != null) return v[b];
    return "";
  },
  /** keep items whose `band` (minimum) is at or below current and `maxBand` (if any) at or above */
  filter(items) {
    const i = ORDER.indexOf(current);
    return items.filter((it) => (it.band ? ORDER.indexOf(it.band) <= i : true) && (it.maxBand ? ORDER.indexOf(it.maxBand) >= i : true));
  },
  on(f) { subs.add(f); return () => subs.delete(f); },
};
