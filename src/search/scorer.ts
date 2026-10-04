import type { CatalogEntry } from "../catalog/schema.ts";

export interface ScoredCatalogEntry extends CatalogEntry {
  score: number;
}

export function isSubsequence(needle: string, haystack: string): boolean {
  if (!needle) return true;
  if (!haystack) return false;

  let nIdx = 0;
  let hIdx = 0;

  while (nIdx < needle.length && hIdx < haystack.length) {
    if (needle[nIdx] === haystack[hIdx]) {
      nIdx++;
    }
    hIdx++;
  }

  return nIdx === needle.length;
}

export function scoreEntry(entry: CatalogEntry, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  const name = entry.name.toLowerCase();
  const desc = entry.description.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);

  let score = 0;

  // Tier 1: exact name match
  if (name === q) {
    score = Math.max(score, 100);
  }
  // Tier 2: name prefix
  else if (name.startsWith(q)) {
    score = Math.max(score, 80);
  }
  // Tier 3: name substring
  else if (name.includes(q)) {
    score = Math.max(score, 60);
  }
  // Tier 4: all tokens in name
  else if (tokens.length > 0 && tokens.every((t) => name.includes(t))) {
    score = Math.max(score, 55);
  }

  // Tier 5: description exact phrase
  if (desc.includes(q)) {
    score = Math.max(score, 50);
  }
  // Tier 6: all tokens in description
  else if (tokens.length > 0 && tokens.every((t) => desc.includes(t))) {
    score = Math.max(score, 40);
  }

  // Tier 7: partial token matches in name or description
  if (tokens.length > 0) {
    const partialHits = tokens.filter((t) => name.includes(t) || desc.includes(t)).length;
    if (partialHits > 0) {
      score = Math.max(score, Math.floor((20 * partialHits) / tokens.length));
    }
  }

  // Tier 8: subsequence fallback
  if (score === 0 && isSubsequence(q, `${name} ${desc}`)) {
    score = 10;
  }

  return score;
}

export function searchCatalog(
  entries: CatalogEntry[],
  query: string
): ScoredCatalogEntry[] {
  const scored: ScoredCatalogEntry[] = [];

  for (const entry of entries) {
    const score = scoreEntry(entry, query);
    if (score > 0) {
      scored.push({ ...entry, score });
    }
  }

  // Sort deterministically: score DESC -> name.length ASC -> name ASC
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.name.length !== b.name.length) {
      return a.name.length - b.name.length;
    }
    return a.name.localeCompare(b.name);
  });

  return scored;
}
