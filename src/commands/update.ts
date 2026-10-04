import { createDefaultResolverChain } from "./add.ts";
import { discoverSkills } from "../skill/discovery.ts";
import { updateInstalledSkill, getSkillDestination } from "../installer.ts";
import { readCatalog, updateCatalogEntry } from "../catalog/catalog.ts";
import type { CatalogEntry } from "../catalog/schema.ts";
import type { OutputFormatter } from "../output/formatter.ts";
import { SourceError } from "../errors.ts";

export interface UpdateOptions {
  name?: string;
  customHome?: string;
}

export async function runUpdate(
  options: UpdateOptions,
  formatter: OutputFormatter,
  resolverChain = createDefaultResolverChain()
): Promise<void> {
  const { name, customHome } = options;
  const catalog = await readCatalog(customHome);

  if (catalog.skills.length === 0) {
    formatter.noResults();
    return;
  }

  let targets: CatalogEntry[] = [];
  if (name) {
    const found = catalog.skills.find((s) => s.name === name);
    if (!found) {
      throw new SourceError(
        "SKILL_NOT_FOUND",
        `skill '${name}' is not recorded in catalog`
      );
    }
    targets = [found];
  } else {
    targets = catalog.skills;
  }

  for (const target of targets) {
    const { result } = await resolverChain.resolve(target.source);

    try {
      const sourceDir = result.tempDir!;
      const report = await discoverSkills(sourceDir);

      const candidate = report.valid.find(
        (c) => c.metadata.name === target.name
      );

      if (!candidate) {
        throw new SourceError(
          "SKILL_NOT_FOUND_IN_SOURCE",
          `skill '${target.name}' was not found in source '${target.source}' during update`
        );
      }

      const destDir = await updateInstalledSkill(
        candidate.skillRoot,
        target.name,
        customHome
      );

      const updatedEntry: CatalogEntry = {
        name: target.name,
        description: candidate.metadata.description,
        source: target.source,
        path: target.path,
        addedAt: new Date().toISOString(),
      };

      await updateCatalogEntry(updatedEntry, customHome);
      formatter.updateSuccess(updatedEntry, destDir);
    } finally {
      await result.cleanup();
    }
  }
}
