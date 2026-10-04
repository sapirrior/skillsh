import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { readCatalog, writeCatalog, addCatalogEntry, getSkillLockPath } from "../../src/catalog/catalog.ts";
import { CatalogError } from "../../src/errors.ts";

describe("Catalog (skill.lock)", () => {
  let tempHome: string;

  beforeEach(async () => {
    tempHome = await mkdtemp(join(tmpdir(), "skillx-test-catalog-"));
  });

  afterEach(async () => {
    await rm(tempHome, { recursive: true, force: true });
  });

  it("returns empty catalog when lockfile does not exist", async () => {
    const catalog = await readCatalog(tempHome);
    expect(catalog.format).toBe(1);
    expect(catalog.skills).toEqual([]);
  });

  it("writes and reads back catalog entry", async () => {
    const entry = {
      name: "code-review",
      description: "Review code",
      source: "https://github.com/example/skills.git",
      path: "skills/code-review",
      addedAt: new Date().toISOString(),
    };

    await addCatalogEntry(entry, tempHome);
    const catalog = await readCatalog(tempHome);
    expect(catalog.skills.length).toBe(1);
    expect(catalog.skills[0].name).toBe("code-review");
  });

  it("throws on duplicate skill names in lockfile", async () => {
    const lockPath = getSkillLockPath(tempHome);
    await mkdir(join(tempHome, ".skillx"), { recursive: true });
    await writeFile(
      lockPath,
      JSON.stringify({
        format: 1,
        skills: [
          { name: "rust", description: "d", source: "s", addedAt: "t" },
          { name: "rust", description: "d", source: "s", addedAt: "t" },
        ],
      })
    );

    expect(readCatalog(tempHome)).rejects.toThrow(CatalogError);
  });

  it("throws on malformed JSON", async () => {
    const lockPath = getSkillLockPath(tempHome);
    await mkdir(join(tempHome, ".skillx"), { recursive: true });
    await writeFile(lockPath, "{ not valid json }");

    expect(readCatalog(tempHome)).rejects.toThrow(CatalogError);
  });

  it("throws on unsupported format version", async () => {
    const lockPath = getSkillLockPath(tempHome);
    await mkdir(join(tempHome, ".skillx"), { recursive: true });
    await writeFile(
      lockPath,
      JSON.stringify({
        format: 99,
        skills: [],
      })
    );

    expect(readCatalog(tempHome)).rejects.toThrow(CatalogError);
  });
});
