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

const STANDARD_CONTAINER_DIRS = ["skills", ".agents/skills", ".claude/skills"];

/**
 * Discovers valid Agent Skills in a directory according to the OpenSkills specification.
 * Prioritization order:
 * 1. Root `SKILL.md` (when the repository is a standalone skill)
 * 2. Standard skill container directories: `skills/`, `.agents/skills/`, `.claude/skills/`
 * 3. Fallback recursive walk if no standard locations exist
 */
export async function discoverSkills(
  sourceDir: string,
  maxDepth = 6
): Promise<DiscoveryReport> {
  const valid: SkillCandidate[] = [];
  const invalid: Array<{ path: string; reason: string }> = [];

  // 1. Check if root itself is a skill (sourceDir/SKILL.md)
  const rootSkillFile = join(sourceDir, "SKILL.md");
  try {
    const rootStat = await stat(rootSkillFile);
    if (rootStat.isFile()) {
      const content = await readFile(rootSkillFile, "utf8");
      const validation = validateSkillContent(content, basename(sourceDir));
      if (validation.ok) {
        valid.push({
          skillRoot: sourceDir,
          skillFile: rootSkillFile,
          metadata: validation.metadata,
        });
      } else {
        invalid.push({
          path: rootSkillFile,
          reason: validation.message,
        });
      }
    }
  } catch {
    // No root SKILL.md
  }

  // 2. Check standard container directories (e.g. skills/<name>/SKILL.md)
  for (const container of STANDARD_CONTAINER_DIRS) {
    const containerPath = join(sourceDir, container);
    try {
      const entries = await readdir(containerPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.isSymbolicLink() && !IGNORED_DIRS.has(entry.name)) {
          const subSkillDir = join(containerPath, entry.name);
          const skillFile = join(subSkillDir, "SKILL.md");
          try {
            const skillStat = await stat(skillFile);
            if (skillStat.isFile()) {
              const content = await readFile(skillFile, "utf8");
              const validation = validateSkillContent(content, entry.name);
              if (validation.ok) {
                valid.push({
                  skillRoot: subSkillDir,
                  skillFile,
                  metadata: validation.metadata,
                });
              } else {
                invalid.push({
                  path: skillFile,
                  reason: validation.message,
                });
              }
            }
          } catch {
            // Not a skill directory
          }
        }
      }
    } catch {
      // Container directory does not exist
    }
  }

  // If skills were found at root or in standard container directories, return them
  if (valid.length > 0 || invalid.length > 0) {
    valid.sort((a, b) => {
      const relA = relative(sourceDir, a.skillRoot);
      const relB = relative(sourceDir, b.skillRoot);
      return relA.localeCompare(relB);
    });
    return { valid, invalid };
  }

  // 3. Fallback recursive walk for repositories without standard directory layouts
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
      if (IGNORED_DIRS.has(entry.name) || entry.isSymbolicLink()) {
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
