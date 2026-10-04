import { getSkillDestination, removeInstalledSkill } from "../installer.ts";
import { readCatalog, removeCatalogEntry } from "../catalog/catalog.ts";
import type { OutputFormatter } from "../output/formatter.ts";
import { SourceError } from "../errors.ts";

export interface RemoveOptions {
  name: string;
  customHome?: string;
}

export async function runRemove(
  options: RemoveOptions,
  formatter: OutputFormatter
): Promise<void> {
  const { name, customHome } = options;
  const catalog = await readCatalog(customHome);

  const entry = catalog.skills.find((s) => s.name === name);
  const destDir = getSkillDestination(name, customHome);

  const destExists = await Bun.file(`${destDir}/SKILL.md`).exists();

  if (!entry && !destExists) {
    throw new SourceError(
      "SKILL_NOT_INSTALLED",
      `skill '${name}' is not installed`
    );
  }

  // Remove files
  await removeInstalledSkill(name, customHome);

  // Remove from catalog
  if (entry) {
    await removeCatalogEntry(name, customHome);
  }

  formatter.removeSuccess(name, destDir);
}
