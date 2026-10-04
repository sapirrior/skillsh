import { describe, it, expect } from "bun:test";
import { validateSkillMetadata, validateSkillContent } from "../../src/skill/validator.ts";

describe("Skill Validator", () => {
  it("validates a valid minimal skill", () => {
    const res = validateSkillMetadata(
      { name: "code-review", description: "Reviews code" },
      "code-review"
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.metadata.name).toBe("code-review");
      expect(res.metadata.description).toBe("Reviews code");
    }
  });

  it("fails on missing name", () => {
    const res = validateSkillMetadata({ description: "No name" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("MISSING_NAME");
    }
  });

  it("fails on uppercase letters in name", () => {
    const res = validateSkillMetadata({ name: "Code-Review", description: "Reviews code" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("INVALID_NAME_PATTERN");
    }
  });

  it("fails on leading/trailing/consecutive hyphens in name", () => {
    expect(validateSkillMetadata({ name: "-bad", description: "desc" }).ok).toBe(false);
    expect(validateSkillMetadata({ name: "bad-", description: "desc" }).ok).toBe(false);
    expect(validateSkillMetadata({ name: "bad--name", description: "desc" }).ok).toBe(false);
  });

  it("fails on name exceeding 64 chars", () => {
    const longName = "a".repeat(65);
    const res = validateSkillMetadata({ name: longName, description: "desc" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("INVALID_NAME_LENGTH");
    }
  });

  it("fails on name-directory mismatch", () => {
    const res = validateSkillMetadata(
      { name: "code-review", description: "desc" },
      "different-dir"
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("NAME_DIRECTORY_MISMATCH");
    }
  });

  it("fails on missing or empty description", () => {
    expect(validateSkillMetadata({ name: "test" }).ok).toBe(false);
    expect(validateSkillMetadata({ name: "test", description: "   " }).ok).toBe(false);
  });

  it("fails on description exceeding 1024 bytes", () => {
    const hugeDesc = "x".repeat(1025);
    const res = validateSkillMetadata({ name: "test", description: hugeDesc });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("DESCRIPTION_TOO_LONG");
    }
  });

  it("preserves extras and optional standard fields", () => {
    const res = validateSkillMetadata({
      name: "valid-skill",
      description: "A description",
      license: "MIT",
      compatibility: "Bun",
      customKey: "customValue",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.metadata.license).toBe("MIT");
      expect(res.metadata.compatibility).toBe("Bun");
      expect(res.metadata.extras.customKey).toBe("customValue");
    }
  });
});
