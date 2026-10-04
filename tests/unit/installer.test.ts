import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { installSkill, getSkillDestination } from "../../src/installer.ts";
import { InstallError } from "../../src/errors.ts";

describe("Skill Installer", () => {
  let tempHome: string;

  beforeEach(async () => {
    tempHome = await mkdtemp(join(tmpdir(), "skillx-test-install-"));
  });

  afterEach(async () => {
    await rm(tempHome, { recursive: true, force: true });
  });

  it("installs skill directory recursively into ~/.agents/skills/<name>", async () => {
    const fixtureDir = join(__dirname, "../fixtures/single-skill/code-review");
    const dest = await installSkill(fixtureDir, "code-review", tempHome);

    expect(dest).toBe(getSkillDestination("code-review", tempHome));

    // Verify SKILL.md copied
    const skillMd = await readFile(join(dest, "SKILL.md"), "utf8");
    expect(skillMd).toContain("name: code-review");

    // Verify script copied
    const script = await readFile(join(dest, "scripts", "review.sh"), "utf8");
    expect(script).toContain("echo \"Running review script\"");
  });

  it("fails when skill already installed without overwrite", async () => {
    const fixtureDir = join(__dirname, "../fixtures/single-skill/code-review");
    await installSkill(fixtureDir, "code-review", tempHome);

    expect(installSkill(fixtureDir, "code-review", tempHome)).rejects.toThrow(InstallError);
  });

  it("overwrites successfully when overwrite = true", async () => {
    const fixtureDir = join(__dirname, "../fixtures/single-skill/code-review");
    await installSkill(fixtureDir, "code-review", tempHome);

    const dest = await installSkill(fixtureDir, "code-review", tempHome, true);
    expect(dest).toBe(getSkillDestination("code-review", tempHome));
  });
});
