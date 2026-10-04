import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { runRemove } from "../../src/commands/remove.ts";
import { runUpdate } from "../../src/commands/update.ts";
import { runAdd } from "../../src/commands/add.ts";
import { readCatalog, addCatalogEntry } from "../../src/catalog/catalog.ts";
import { installSkill, getSkillDestination } from "../../src/installer.ts";
import { JsonFormatter } from "../../src/output/json.ts";
import { SourceError } from "../../src/errors.ts";
import { ResolverChain, type SourceResolver, type SourceResult } from "../../src/source/resolver.ts";

class MockResolver implements SourceResolver {
  readonly name = "MockResolver";
  constructor(private skillDir: string) {}

  canHandle(source: string): boolean {
    return source.startsWith("mock://");
  }

  async resolve(_source: string): Promise<SourceResult> {
    return {
      type: "directory",
      tempDir: this.skillDir,
      cleanup: async () => {},
    };
  }
}

describe("Commands: remove and update", () => {
  let tempHome: string;
  let singleFixture: string;

  beforeEach(async () => {
    tempHome = await mkdtemp(join(tmpdir(), "skillx-test-rmup-"));
    singleFixture = join(__dirname, "../fixtures/single-skill");
  });

  afterEach(async () => {
    await rm(tempHome, { recursive: true, force: true });
  });

  it("removes an installed skill and its catalog entry", async () => {
    const formatter = new JsonFormatter();
    const skillDir = join(singleFixture, "code-review");
    await installSkill(skillDir, "code-review", tempHome);
    await addCatalogEntry(
      {
        name: "code-review",
        description: "Desc",
        source: "mock://single",
        addedAt: new Date().toISOString(),
      },
      tempHome
    );

    // Verify present
    let catalog = await readCatalog(tempHome);
    expect(catalog.skills.length).toBe(1);

    // Remove
    await runRemove({ name: "code-review", customHome: tempHome }, formatter);

    // Verify removed
    catalog = await readCatalog(tempHome);
    expect(catalog.skills.length).toBe(0);
    const dest = getSkillDestination("code-review", tempHome);
    const exists = await Bun.file(`${dest}/SKILL.md`).exists();
    expect(exists).toBe(false);
  });

  it("throws error when removing non-existent skill", async () => {
    const formatter = new JsonFormatter();
    expect(
      runRemove({ name: "non-existent", customHome: tempHome }, formatter)
    ).rejects.toThrow(SourceError);
  });

  it("updates an installed skill", async () => {
    const formatter = new JsonFormatter();
    const chain = new ResolverChain().register(new MockResolver(singleFixture));

    // Install initial
    await runAdd(
      { source: "mock://single", customHome: tempHome },
      formatter,
      chain
    );

    // Update
    await runUpdate(
      { name: "code-review", customHome: tempHome },
      formatter,
      chain
    );

    const catalog = await readCatalog(tempHome);
    expect(catalog.skills.length).toBe(1);
    expect(catalog.skills[0].name).toBe("code-review");
  });
});
