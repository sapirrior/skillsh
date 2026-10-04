import { ValidationError } from "../errors.ts";

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

/**
 * Minimal, zero-dependency YAML parser for frontmatter key-value pairs,
 * multiline block scalars (| and >), basic lists, and quoted strings.
 */
export function parseYamlSubset(yamlText: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yamlText.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Skip empty lines or comment lines
    if (!line || line.startsWith("#")) {
      i++;
      continue;
    }

    // Top-level key: value
    const colonIdx = rawLine.indexOf(":");
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = rawLine.slice(0, colonIdx).trim();
    if (!key) {
      i++;
      continue;
    }

    const valueRest = rawLine.slice(colonIdx + 1).trim();

    // Block scalar (| or >)
    if (valueRest === "|" || valueRest === ">" || valueRest === "|-" || valueRest === ">-") {
      const isFolded = valueRest.startsWith(">");
      i++;
      const blockLines: string[] = [];
      let baseIndent = -1;

      while (i < lines.length) {
        const nextRaw = lines[i];
        if (nextRaw.trim() === "") {
          blockLines.push("");
          i++;
          continue;
        }

        const currentIndent = nextRaw.search(/\S/);
        if (baseIndent === -1) {
          if (currentIndent <= 0) {
            break;
          }
          baseIndent = currentIndent;
        } else if (currentIndent < baseIndent) {
          break;
        }

        blockLines.push(nextRaw.slice(baseIndent));
        i++;
      }

      if (isFolded) {
        result[key] = blockLines.join(" ").trim();
      } else {
        result[key] = blockLines.join("\n").trimEnd();
      }
      continue;
    }

    // List value
    if (valueRest === "" && i + 1 < lines.length && lines[i + 1].trim().startsWith("-")) {
      i++;
      const listItems: unknown[] = [];
      while (i < lines.length) {
        const nextTrimmed = lines[i].trim();
        if (!nextTrimmed.startsWith("-")) {
          break;
        }
        const itemVal = nextTrimmed.slice(1).trim();
        listItems.push(parseScalarValue(itemVal));
        i++;
      }
      result[key] = listItems;
      continue;
    }

    result[key] = parseScalarValue(valueRest);
    i++;
  }

  return result;
}

function parseScalarValue(val: string): unknown {
  if (val === "" || val === "null" || val === "~") return "";
  if (val === "true") return true;
  if (val === "false") return false;

  // Quoted string (double or single)
  if (
    (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
    (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
  ) {
    return val.slice(1, -1);
  }

  // Number
  if (/^-?\d+(\.\d+)?$/.test(val)) {
    return Number(val);
  }

  return val;
}

/**
 * Extracts and parses frontmatter from SKILL.md content.
 */
export function extractFrontmatter(rawContent: string): ParsedFrontmatter {
  if (!rawContent.startsWith("---")) {
    throw new ValidationError(
      "MISSING_FRONTMATTER",
      "SKILL.md must begin with '---' on the first line"
    );
  }

  // Look for closing delimiter
  // Must match --- on a line of its own after the first line
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new ValidationError(
      "UNCLOSED_FRONTMATTER",
      "SKILL.md frontmatter is not closed with '---'"
    );
  }

  const yamlBlock = match[1];
  const bodyContent = match[2] ?? "";

  try {
    const data = parseYamlSubset(yamlBlock);
    return { data, content: bodyContent };
  } catch (err) {
    throw new ValidationError(
      "INVALID_YAML",
      `Failed to parse YAML frontmatter: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
