#!/usr/bin/env node
// Regenerates the CYTOBAND block in assets/js/world/levels/karyotypeContent.js from a UCSC cytoBand file.
// Usage: node tools/cytoband-to-karyotype.mjs path/to/cytoBand.txt   (tab-separated: chrom, start, end, name, gieStain)
// Rows for chr1-22, X and Y are written as [name, gieStain, start, end]; the level then uses them instead of its
// hand-entered schematic table. Centromere index and chromosome length still come from the RAW table (edit those
// there if the reference assembly differs). Plain-text input only; this script does not fetch anything.
import { readFileSync, writeFileSync } from "node:fs";
const input = process.argv[2];
if (!input) { console.error("usage: node tools/cytoband-to-karyotype.mjs cytoBand.txt"); process.exit(1); }
const target = new URL("../assets/js/world/levels/karyotypeContent.js", import.meta.url);
const GIE = new Set(["gneg", "gpos25", "gpos50", "gpos75", "gpos100", "gvar", "stalk", "acen"]);
const out = {};
for (const line of readFileSync(input, "utf8").split(/\r?\n/)) {
  if (!line.trim() || line.startsWith("#")) continue;
  const [chrom, start, end, name, gie] = line.split("\t");
  const m = /^chr(\d+|X|Y)$/.exec(chrom);
  if (!m || !GIE.has(gie)) continue;               // skips chrM, alt/unplaced contigs, unknown stains
  (out[m[1]] ||= []).push([name, gie, +start, +end]);
}
const ids = [...Array(22).keys()].map((i) => String(i + 1)).concat(["X", "Y"]);
const missing = ids.filter((i) => !out[i]);
if (missing.length) { console.error("missing chromosomes: " + missing.join(", ")); process.exit(1); }
const body = "export const CYTOBAND = {\n" + ids.map((i) => `  ${/^\d+$/.test(i) ? `"${i}"` : `"${i}"`}: ${JSON.stringify(out[i])},`).join("\n") + "\n};";
const src = readFileSync(target, "utf8");
const re = /(\/\/ <CYTOBAND:begin>\n)[\s\S]*?(\n\/\/ <CYTOBAND:end>)/;
if (!re.test(src)) { console.error("CYTOBAND markers not found"); process.exit(1); }
writeFileSync(target, src.replace(re, `$1${body}$2`));
console.log("wrote CYTOBAND rows for " + ids.length + " chromosomes");
