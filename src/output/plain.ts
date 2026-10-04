import { homedir } from "os";
import type { CatalogEntry } from "../catalog/schema.ts";
import type { OutputFormatter } from "./formatter.ts";
import { c } from "./colors.ts";

export class PlainFormatter implements OutputFormatter {
  private getTerminalWidth(): number {
    if (process.env.COLUMNS) {
      const parsed = parseInt(process.env.COLUMNS, 10);
      if (!isNaN(parsed) && parsed > 10) {
        return parsed;
      }
    }
    if (process.stdout.columns && process.stdout.columns > 10) {
      return process.stdout.columns;
    }
    return 80;
  }

  addSuccess(entry: CatalogEntry, installPath: string): void {
    const home = homedir();
    const displayPath = installPath.startsWith(home)
      ? `~${installPath.slice(home.length)}`
      : installPath;

    console.log(`installed: ${c.cyan(entry.name)}`);
    console.log(`path:      ${c.dim(displayPath)}`);
    console.log(`source:    ${c.dim(entry.source)}`);
  }

  removeSuccess(name: string, installPath: string): void {
    const home = homedir();
    const displayPath = installPath.startsWith(home)
      ? `~${installPath.slice(home.length)}`
      : installPath;

    console.log(`removed: ${c.cyan(name)}`);
    console.log(`path:    ${c.dim(displayPath)}`);
  }

  updateSuccess(entry: CatalogEntry, installPath: string): void {
    const home = homedir();
    const displayPath = installPath.startsWith(home)
      ? `~${installPath.slice(home.length)}`
      : installPath;

    console.log(`updated: ${c.cyan(entry.name)}`);
    console.log(`path:    ${c.dim(displayPath)}`);
    console.log(`source:  ${c.dim(entry.source)}`);
  }

  searchResults(entries: Array<CatalogEntry & { score: number }>): void {
    if (entries.length === 0) {
      return;
    }
    this.renderEntries(entries);
  }

  listResults(entries: CatalogEntry[]): void {
    if (entries.length === 0) {
      return;
    }
    this.renderEntries(entries);
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.replace(/\s+/g, " ").trim().split(" ");
    if (words.length === 0 || maxWidth <= 0) return [text];

    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if (!currentLine) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxWidth) {
        currentLine += ` ${word}`;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  private renderEntries(entries: CatalogEntry[]): void {
    const termWidth = this.getTerminalWidth();

    // On narrow screens (< 50 columns), use stacked entries
    if (termWidth < 50) {
      console.log(c.cyan(c.bold("Installed Skills:")));
      console.log(c.gray("─".repeat(termWidth)));

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        console.log(`- ${c.bold(entry.name)}`);
        const desc = entry.description.replace(/\r?\n|\r/g, " ").trim();
        const wrapped = this.wrapText(desc, Math.max(15, termWidth - 2));
        for (const line of wrapped) {
          console.log(`  ${line}`);
        }
        if (i < entries.length - 1) {
          console.log();
        }
      }
      return;
    }

    // Standard / Wide view: responsive table
    const maxNameLen = Math.max(
      4,
      Math.min(30, ...entries.map((e) => e.name.length))
    );
    const colWidth = maxNameLen + 4;
    const descMaxLen = Math.max(20, termWidth - colWidth - 1);

    console.log(`${c.cyan(c.bold("name".padEnd(colWidth)))}${c.bold(c.dim("description"))}`);
    console.log(c.gray("─".repeat(termWidth)));

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const desc = entry.description.replace(/\r?\n|\r/g, " ").trim();
      const wrappedLines = this.wrapText(desc, descMaxLen);

      console.log(`${c.bold(entry.name.padEnd(colWidth))}${wrappedLines[0] || ""}`);
      for (let j = 1; j < wrappedLines.length; j++) {
        console.log(`${"".padEnd(colWidth)}${wrappedLines[j]}`);
      }

      if (wrappedLines.length > 1 && i < entries.length - 1) {
        console.log();
      }
    }
  }

  noResults(query?: string): void {
    if (query) {
      console.log(`no skills found matching '${query}'`);
    } else {
      console.log("no skills installed");
    }
    console.log("run 'skillx add <source>' to install skills");
  }

  error(msg: string): void {
    let formatted = msg;
    if (formatted.startsWith("error:")) {
      formatted = `${c.brightRed(c.bold("error:"))}${formatted.slice("error:".length)}`;
    } else {
      formatted = `${c.brightRed(c.bold("error:"))} ${formatted}`;
    }
    console.error(formatted);
  }
}
