import { readCatalog } from "../catalog/catalog.ts";
import { searchCatalog } from "../search/scorer.ts";
import type { OutputFormatter } from "../output/formatter.ts";

export interface SearchOptions {
  query: string;
  customHome?: string;
}

export async function runSearch(
  options: SearchOptions,
  formatter: OutputFormatter
): Promise<void> {
  const catalog = await readCatalog(options.customHome);
  const results = searchCatalog(catalog.skills, options.query);

  if (results.length === 0) {
    formatter.noResults(options.query);
    return;
  }

  formatter.searchResults(results);
}
