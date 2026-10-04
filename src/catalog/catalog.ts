import { readFile, writeFile, rename, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { homedir } from "os";
import type { Catalog, CatalogEntry } from "./schema.ts";
import { CatalogError } from "../errors.ts";

export const CURRENT_CATALOG_FORMAT = 1;

export function getCatalogDir(customHome?: string): string {
  const home = customHome || process.env.HOME || homedir();
  return join(home, ".skillx");
}

export function getSkillLockPath(customHome?: string): string {
  return join(getCatalogDir(customHome), "skill.lock");
}

export async function readCatalog(customHome?: string): Promise<Catalog> {
  const lockPath = getSkillLockPath(customHome);

  let rawContent: string;
  try {
    rawContent = await readFile(lockPath, "utf8");
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return {
        format: CURRENT_CATALOG_FORMAT,
        skills: [],
      };
    }
    throw new CatalogError(
      "READ_ERROR",
      `Failed to read catalog at ${lockPath}: ${err.message}`
    );
  }

  if (rawContent.trim() === "") {
    throw new CatalogError(
      "EMPTY_LOCK_FILE",
      "skill.lock is empty — not valid JSON"
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    throw new CatalogError(
      "MALFORMED_JSON",
      `${lockPath} contains invalid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CatalogError(
      "INVALID_SCHEMA",
      `${lockPath} root must be an object`
    );
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.format !== "number") {
    throw new CatalogError(
      "MISSING_FORMAT",
      `${lockPath} is missing numeric 'format' version`
    );
  }

  if (obj.format !== CURRENT_CATALOG_FORMAT) {
    throw new CatalogError(
      "UNSUPPORTED_FORMAT",
      `${lockPath} format version ${obj.format} is not supported by this version of skillx`
    );
  }

  if (!Array.isArray(obj.skills)) {
    throw new CatalogError(
      "MISSING_SKILLS_ARRAY",
      `${lockPath} is missing required 'skills' array`
    );
  }

  const seenNames = new Set<string>();
  const duplicateNames: string[] = [];

  for (const entry of obj.skills) {
    if (!entry || typeof entry !== "object") {
      throw new CatalogError("INVALID_ENTRY", "Catalog entry must be an object");
    }
    const { name, description, source, addedAt } = entry as Record<string, unknown>;
    if (typeof name !== "string" || !name) {
      throw new CatalogError("INVALID_ENTRY", "Skill entry must have non-empty string 'name'");
    }
    if (typeof description !== "string") {
      throw new CatalogError("INVALID_ENTRY", `Skill entry '${name}' must have string 'description'`);
    }
    if (typeof source !== "string" || !source) {
      throw new CatalogError("INVALID_ENTRY", `Skill entry '${name}' must have string 'source'`);
    }
    if (typeof addedAt !== "string" || !addedAt) {
      throw new CatalogError("INVALID_ENTRY", `Skill entry '${name}' must have ISO 'addedAt' timestamp`);
    }

    if (seenNames.has(name)) {
      duplicateNames.push(name);
    } else {
      seenNames.add(name);
    }
  }

  if (duplicateNames.length > 0) {
    throw new CatalogError(
      "DUPLICATE_NAMES",
      `${lockPath} contains duplicate skill names: ${duplicateNames.join(", ")}`
    );
  }

  return obj as unknown as Catalog;
}

export async function writeCatalog(
  catalog: Catalog,
  customHome?: string
): Promise<void> {
  const lockPath = getSkillLockPath(customHome);
  const dir = dirname(lockPath);

  await mkdir(dir, { recursive: true });

  const tempPath = `${lockPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const content = JSON.stringify(catalog, null, 2) + "\n";

  try {
    await writeFile(tempPath, content, "utf8");
    await rename(tempPath, lockPath);
  } catch (err) {
    throw new CatalogError(
      "WRITE_ERROR",
      `Failed to write catalog to ${lockPath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function addCatalogEntry(
  entry: CatalogEntry,
  customHome?: string,
  overwrite = false
): Promise<Catalog> {
  const catalog = await readCatalog(customHome);
  const existingIdx = catalog.skills.findIndex((s) => s.name === entry.name);

  if (existingIdx !== -1) {
    if (!overwrite) {
      throw new CatalogError(
        "ALREADY_IN_CATALOG",
        `Skill '${entry.name}' is already recorded in catalog`
      );
    }
    catalog.skills[existingIdx] = entry;
  } else {
    catalog.skills.push(entry);
  }

  await writeCatalog(catalog, customHome);
  return catalog;
}

export async function removeCatalogEntry(
  name: string,
  customHome?: string
): Promise<{ removed: boolean; catalog: Catalog }> {
  const catalog = await readCatalog(customHome);
  const initialLength = catalog.skills.length;
  catalog.skills = catalog.skills.filter((s) => s.name !== name);

  const removed = catalog.skills.length < initialLength;
  if (removed) {
    await writeCatalog(catalog, customHome);
  }
  return { removed, catalog };
}

export async function updateCatalogEntry(
  entry: CatalogEntry,
  customHome?: string
): Promise<Catalog> {
  const catalog = await readCatalog(customHome);
  const idx = catalog.skills.findIndex((s) => s.name === entry.name);

  if (idx === -1) {
    catalog.skills.push(entry);
  } else {
    catalog.skills[idx] = entry;
  }

  await writeCatalog(catalog, customHome);
  return catalog;
}
