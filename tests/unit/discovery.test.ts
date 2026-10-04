import { describe, it, expect } from "bun:test";
import { join } from "path";
import { discoverSkills } from "../../src/skill/discovery.ts";

describe("Skill Discovery", () => {
  it("discovers single skill correctly", async () => {
    const fixtureDir = join(__dirname, "../fixtures/single-skill");
    const report = await discoverSkills(fixtureDir);

    expect(report.valid.length).toBe(1);
    expect(report.valid[0].metadata.name).toBe("code-review");
  });

  it("discovers multi-skill directory deterministically sorted", async () => {
    const fixtureDir = join(__dirname, "../fixtures/multi-skill");
    const report = await discoverSkills(fixtureDir);

    expect(report.valid.length).toBe(2);
    expect(report.valid.map((c) => c.metadata.name)).toEqual(["rust", "testing"]);
  });

  it("identifies invalid skills without crashing", async () => {
    const fixtureDir = join(__dirname, "../fixtures/invalid-skill");
    const report = await discoverSkills(fixtureDir);

    expect(report.valid.length).toBe(0);
    expect(report.invalid.length).toBe(1);
    expect(report.invalid[0].reason).toContain("does not match parent directory");
  });
});
