import type { CatalogEntry } from "../catalog/schema.ts";
import type { OutputFormatter } from "./formatter.ts";

export class JsonFormatter implements OutputFormatter {
  addSuccess(entry: CatalogEntry, installPath: string): void {
    console.log(
      JSON.stringify(
        {
          success: true,
          action: "add",
          entry,
          installPath,
        },
        null,
        2
      )
    );
  }

  removeSuccess(name: string, installPath: string): void {
    console.log(
      JSON.stringify(
        {
          success: true,
          action: "remove",
          name,
          installPath,
        },
        null,
        2
      )
    );
  }

  updateSuccess(entry: CatalogEntry, installPath: string): void {
    console.log(
      JSON.stringify(
        {
          success: true,
          action: "update",
          entry,
          installPath,
        },
        null,
        2
      )
    );
  }

  searchResults(entries: Array<CatalogEntry & { score: number }>): void {
    console.log(JSON.stringify(entries, null, 2));
  }

  listResults(entries: CatalogEntry[]): void {
    console.log(JSON.stringify(entries, null, 2));
  }

  noResults(_query?: string): void {
    console.log(JSON.stringify([], null, 2));
  }

  error(msg: string): void {
    console.error(
      JSON.stringify(
        {
          error: msg,
        },
        null,
        2
      )
    );
  }
}
