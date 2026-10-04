import { relative, join } from "path";
import { homedir } from "os";
import { createInterface } from "readline";
import { ResolverChain } from "../source/resolver.ts";
import { DirectSkillFileResolver } from "../source/direct-skill.ts";
import { GitRepoResolver } from "../source/git-repo.ts";
import { GitHubShorthandResolver } from "../source/github-shorthand.ts";
import { discoverSkills } from "../skill/discovery.ts";
import {
  installSkill,
  rollbackInstallation,
  isSkillInstalled,
  getSkillDestination,
} from "../installer.ts";
import { addCatalogEntry } from "../catalog/catalog.ts";
import type { CatalogEntry } from "../catalog/schema.ts";
import type { OutputFormatter } from "../output/formatter.ts";
import { SourceError } from "../errors.ts";
import { c } from "../output/colors.ts";

export interface AddOptions {
  source: string;
  skill?: string;
  force?: boolean;
  customHome?: string;
  askConfirmation?: (message: string) => Promise<boolean>;
}

export function createDefaultResolverChain(): ResolverChain {
  const chain = new ResolverChain();
  chain.register(new DirectSkillFileResolver());
  chain.register(new GitHubShorthandResolver());
  chain.register(new GitRepoResolver());
  return chain;
}

export async function defaultConfirmPrompt(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      resolve(trimmed === "y" || trimmed === "yes");
    });
  });
}

export async function runAdd(
  options: AddOptions,
  formatter: OutputFormatter,
  resolverChain = createDefaultResolverChain()
): Promise<void> {
  const { source, skill: requestedSkill, force, customHome, askConfirmation } = options;

  const { result } = await resolverChain.resolve(source);

  try {
    const sourceDir = result.tempDir!;
    const report = await discoverSkills(sourceDir);

    if (report.valid.length === 0) {
      throw new SourceError(
        "NO_SKILLS_FOUND",
        "no valid Agent Skill found in source"
      );
    }

    let selectedCandidate;

    if (requestedSkill) {
      selectedCandidate = report.valid.find(
        (c) => c.metadata.name === requestedSkill
      );
      if (!selectedCandidate) {
        const available = report.valid.map((c) => c.metadata.name).join(", ");
        throw new SourceError(
          "SKILL_NOT_FOUND",
          `skill '${requestedSkill}' specified with --skill was not found in source\n       available skills: ${available}`
        );
      }
    } else {
      if (report.valid.length === 1) {
        selectedCandidate = report.valid[0];
      } else {
        const maxLen = Math.max(...report.valid.map((c) => c.metadata.name.length));
        const formatted = report.valid
          .map(
            (c) =>
              `    ${c.metadata.name.padEnd(maxLen + 4)}${c.metadata.description}`
          )
          .join("\n");
        throw new SourceError(
          "AMBIGUOUS_SKILL",
          `source contains ${report.valid.length} skills; choose one with --skill <name>\n\n  available skills:\n${formatted}`
        );
      }
    }

    const skillName = selectedCandidate.metadata.name;
    const destDir = getSkillDestination(skillName, customHome);
    const home = customHome || process.env.HOME || homedir();
    const displayPath = destDir.startsWith(home)
      ? `~${destDir.slice(home.length)}`
      : destDir;

    let overwrite = false;
    const alreadyExists = await isSkillInstalled(skillName, customHome);

    if (alreadyExists) {
      if (force) {
        overwrite = true;
      } else if (process.stdin.isTTY || askConfirmation) {
        const promptFn = askConfirmation || defaultConfirmPrompt;
        const confirmMsg = `skill '${c.cyan(skillName)}' is already installed at ${c.dim(displayPath)}.\nOverwrite and replace it? (y/N): `;
        const confirmed = await promptFn(confirmMsg);
        if (!confirmed) {
          throw new SourceError(
            "INSTALL_ABORTED",
            `installation of '${skillName}' aborted (destination already exists)`
          );
        }
        overwrite = true;
      } else {
        throw new SourceError(
          "ALREADY_INSTALLED",
          `skill '${skillName}' is already installed at ${displayPath}. Use --force to overwrite.`
        );
      }
    }

    // Install the skill
    await installSkill(
      selectedCandidate.skillRoot,
      skillName,
      customHome,
      overwrite
    );

    // Record catalog entry
    let relPath: string | undefined;
    if (result.type === "directory") {
      const p = relative(sourceDir, selectedCandidate.skillRoot);
      if (p && p !== ".") {
        relPath = p;
      }
    }

    const entry: CatalogEntry = {
      name: skillName,
      description: selectedCandidate.metadata.description,
      source,
      path: relPath,
      addedAt: new Date().toISOString(),
    };

    try {
      await addCatalogEntry(entry, customHome, overwrite);
    } catch (err) {
      if (!overwrite) {
        await rollbackInstallation(destDir);
      }
      throw err;
    }

    formatter.addSuccess(entry, destDir);
  } finally {
    await result.cleanup();
  }
}
