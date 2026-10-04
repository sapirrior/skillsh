import type { CatalogEntry } from "../catalog/schema.ts";

export interface OutputFormatter {
  addSuccess(entry: CatalogEntry, installPath: string): void;
  removeSuccess(name: string, installPath: string): void;
  updateSuccess(entry: CatalogEntry, installPath: string): void;
  searchResults(entries: Array<CatalogEntry & { score: number }>): void;
  listResults(entries: CatalogEntry[]): void;
  noResults(query?: string): void;
  error(msg: string): void;
}
