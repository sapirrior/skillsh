import { readdir, readFile, stat, lstat } from "fs/promises";
import { join, relative, basename } from "path";
import type { SkillMetadata } from "./validator.ts";
import { validateSkillContent } from "./validator.ts";

export interface SkillCandidate {
  /** Absolute path to the skill root directory */
  skillRoot: string;
  /** Absolute path to SKILL.md */
  skillFile: string;
  /** Parsed and validated metadata */
  metadata: SkillMetadata;
}

export interface DiscoveryReport {
  valid: SkillCandidate[];
  invalid: Array<{ path: string; reason: string }>;
}

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".cache",
  ".husky",
  ".github",
  ".turbo",
  ".venv",
  "__pycache__",
]);

/**
 * Recursively discovers valid Agent Skills in a directory.
 */
export async function discoverSkills(
  sourceDir: string,
  maxDepth = 6
): Promise<DiscoveryReport> {
  const valid: SkillCandidate[] = [];
  const invalid: Array<{ path: string; reason: string }> = [];

  async function walk(currentDir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch (err) {
      invalid.push({
        path: currentDir,
        reason: `Cannot read directory: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isFile() && entry.name === "SKILL.md") {
        const skillFilePath = join(currentDir, "SKILL.md");
        const dirBasename = basename(currentDir);

        try {
          const content = await readFile(skillFilePath, "utf8");
          const validation = validateSkillContent(content, dirBasename);

          if (validation.ok) {
            valid.push({
              skillRoot: currentDir,
              skillFile: skillFilePath,
              metadata: validation.metadata,
            });
          } else {
            invalid.push({
              path: skillFilePath,
              reason: validation.message,
            });
          }
        } catch (err) {
          invalid.push({
            path: skillFilePath,
            reason: `Error reading file: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      } else if (entry.isDirectory()) {
        await walk(join(currentDir, entry.name), depth + 1);
      }
    }
  }

  await walk(sourceDir, 0);

  // Sort candidates deterministically by relative path
  valid.sort((a, b) => {
    const relA = relative(sourceDir, a.skillRoot);
    const relB = relative(sourceDir, b.skillRoot);
    return relA.localeCompare(relB);
  });

  return { valid, invalid };
}
