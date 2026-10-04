import { readCatalog } from "../catalog/catalog.ts";
import type { OutputFormatter } from "../output/formatter.ts";

export interface ListOptions {
  customHome?: string;
}

export async function runList(
  options: ListOptions,
  formatter: OutputFormatter
): Promise<void> {
  const catalog = await readCatalog(options.customHome);

  if (catalog.skills.length === 0) {
    formatter.noResults();
    return;
  }

  // Sort deterministically by name
  const sorted = [...catalog.skills].sort((a, b) => a.name.localeCompare(b.name));
  formatter.listResults(sorted);
}
