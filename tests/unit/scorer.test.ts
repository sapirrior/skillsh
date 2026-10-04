import { describe, it, expect } from "bun:test";
import { scoreEntry, searchCatalog } from "../../src/search/scorer.ts";
import type { CatalogEntry } from "../../src/catalog/schema.ts";

describe("Search Scorer", () => {
  const entries: CatalogEntry[] = [
    {
      name: "code-review",
      description: "Review code for correctness and maintainability",
      source: "https://example.com/SKILL.md",
      addedAt: "2026-10-04T00:00:00Z",
    },
    {
      name: "rust",
      description: "Rust development guidance and idiomatic practices",
      source: "https://example.com/rust/SKILL.md",
      addedAt: "2026-10-04T00:00:00Z",
    },
    {
      name: "testing",
      description: "Testing patterns and unit test helpers for code review",
      source: "https://example.com/test/SKILL.md",
      addedAt: "2026-10-04T00:00:00Z",
    },
  ];

  it("prioritizes exact name match (score 100)", () => {
    const score = scoreEntry(entries[0], "code-review");
    expect(score).toBe(100);
  });

  it("prioritizes name prefix match (score 80)", () => {
    const score = scoreEntry(entries[0], "code");
    expect(score).toBe(80);
  });

  it("scores description phrase match (score 50)", () => {
    const score = scoreEntry(entries[1], "development guidance");
    expect(score).toBe(50);
  });

  it("returns 0 for completely unrelated query", () => {
    const score = scoreEntry(entries[1], "python flask django");
    expect(score).toBe(0);
  });

  it("orders search results deterministically by score", () => {
    const results = searchCatalog(entries, "code review");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].name).toBe("code-review");
  });
});
