export interface CatalogEntry {
  name: string;
  description: string;
  source: string;
  path?: string;
  addedAt: string; // ISO 8601 UTC
}

export interface Catalog {
  format: number;
  skills: CatalogEntry[];
}
