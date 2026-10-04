import { c } from "./colors.ts";

export function getTerminalWidth(): number {
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

function wrapText(text: string, maxWidth: number): string[] {
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

export interface HelpItem {
  label: string;
  description: string;
}

export interface HelpSection {
  title: string;
  items: HelpItem[];
}

export function formatHelp(config: {
  title: string;
  description?: string;
  version?: string;
  usage: string[];
  sections: HelpSection[];
  examples?: string[];
}): string {
  const termWidth = getTerminalWidth();
  const out: string[] = [];

  // Header
  let header = `${c.cyan(c.bold(config.title))}`;
  if (config.description) {
    header += ` ${c.dim(`— ${config.description}`)}`;
  }
  if (config.version) {
    header += ` ${c.gray(`v${config.version}`)}`;
  }
  out.push(header);
  out.push("");

  // Usage
  out.push(c.bold("Usage:"));
  for (const u of config.usage) {
    out.push(`  ${u}`);
  }
  out.push("");

  // Sections (Commands, Arguments, Options)
  const isNarrow = termWidth < 55;

  for (const section of config.sections) {
    out.push(c.bold(section.title));

    if (isNarrow) {
      for (const item of section.items) {
        out.push(`  ${item.label}`);
        const wrapped = wrapText(item.description, Math.max(15, termWidth - 4));
        for (const line of wrapped) {
          out.push(`    ${line}`);
        }
      }
    } else {
      // Find max label length (clamped)
      // Strip ANSI escape codes when computing label length
      const stripAnsi = (str: string) => str.replace(/\x1B\[\d+m/g, "");
      const maxLabelLen = Math.max(
        ...section.items.map((it) => stripAnsi(it.label).length),
        8
      );
      const colWidth = maxLabelLen + 3;
      const descWidth = Math.max(20, termWidth - colWidth - 2);

      for (const item of section.items) {
        const rawLabelLen = stripAnsi(item.label).length;
        const padding = " ".repeat(Math.max(1, colWidth - rawLabelLen));
        const wrapped = wrapText(item.description, descWidth);

        out.push(`  ${item.label}${padding}${wrapped[0] || ""}`);
        for (let i = 1; i < wrapped.length; i++) {
          out.push(`  ${" ".repeat(colWidth)}${wrapped[i]}`);
        }
      }
    }
    out.push("");
  }

  // Examples
  if (config.examples && config.examples.length > 0) {
    out.push(c.bold("Examples:"));
    for (const ex of config.examples) {
      out.push(`  ${c.dim("$")} ${ex}`);
    }
    out.push("");
  }

  return out.join("\n").trimEnd();
}
