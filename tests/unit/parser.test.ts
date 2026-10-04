import { describe, it, expect } from "bun:test";
import { extractFrontmatter, parseYamlSubset } from "../../src/skill/parser.ts";
import { ValidationError } from "../../src/errors.ts";

describe("YAML Subset Parser", () => {
  it("parses key-value pairs and comments", () => {
    const yaml = `
# Comment here
name: code-review
description: High quality code review
count: 42
active: true
`;
    const data = parseYamlSubset(yaml);
    expect(data.name).toBe("code-review");
    expect(data.description).toBe("High quality code review");
    expect(data.count).toBe(42);
    expect(data.active).toBe(true);
  });

  it("parses quoted strings", () => {
    const yaml = `
name: "double-quoted"
desc: 'single-quoted'
`;
    const data = parseYamlSubset(yaml);
    expect(data.name).toBe("double-quoted");
    expect(data.desc).toBe("single-quoted");
  });

  it("parses multiline block scalars | and >", () => {
    const yaml = `
description: |
  Line 1
  Line 2
folded: >
  Folded line 1
  Folded line 2
`;
    const data = parseYamlSubset(yaml);
    expect(data.description).toBe("Line 1\nLine 2");
    expect(data.folded).toBe("Folded line 1 Folded line 2");
  });

  it("parses lists", () => {
    const yaml = `
name: testing
tags:
  - unit
  - e2e
  - integration
`;
    const data = parseYamlSubset(yaml);
    expect(data.name).toBe("testing");
    expect(data.tags).toEqual(["unit", "e2e", "integration"]);
  });
});

describe("Frontmatter Extraction", () => {
  it("extracts frontmatter and body correctly", () => {
    const content = `---
name: my-skill
description: A helpful skill
---

# Title
Instructions here.
`;
    const { data, content: body } = extractFrontmatter(content);
    expect(data.name).toBe("my-skill");
    expect(data.description).toBe("A helpful skill");
    expect(body.trim()).toBe("# Title\nInstructions here.");
  });

  it("throws ValidationError when opening delimiter is missing", () => {
    const content = `name: test\n---\nBody`;
    expect(() => extractFrontmatter(content)).toThrow(ValidationError);
  });

  it("throws ValidationError when closing delimiter is missing", () => {
    const content = `---\nname: test\nBody without closing`;
    expect(() => extractFrontmatter(content)).toThrow(ValidationError);
  });
});
