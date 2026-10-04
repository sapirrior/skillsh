import { basename } from "path";
import { extractFrontmatter } from "./parser.ts";
import { ValidationError } from "../errors.ts";

export type ValidationErrorCode =
  | "MISSING_FRONTMATTER"
  | "UNCLOSED_FRONTMATTER"
  | "INVALID_YAML"
  | "MISSING_NAME"
  | "INVALID_NAME_TYPE"
  | "INVALID_NAME_PATTERN"
  | "INVALID_NAME_LENGTH"
  | "NAME_DIRECTORY_MISMATCH"
  | "MISSING_DESCRIPTION"
  | "INVALID_DESCRIPTION_TYPE"
  | "EMPTY_DESCRIPTION"
  | "DESCRIPTION_TOO_LONG";

export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  compatibility?: unknown;
  metadata?: unknown;
  allowedTools?: unknown;
  extras: Record<string, unknown>;
}

export type ValidationResult =
  | { ok: true; metadata: SkillMetadata }
  | { ok: false; code: ValidationErrorCode; message: string };

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_BYTES = 1024;

export function validateSkillMetadata(
  data: Record<string, unknown>,
  parentDirBasename?: string
): ValidationResult {
  // Validate 'name'
  if (!("name" in data) || data.name === undefined || data.name === null) {
    return {
      ok: false,
      code: "MISSING_NAME",
      message: "SKILL.md is missing required 'name' field in frontmatter",
    };
  }

  if (typeof data.name !== "string") {
    return {
      ok: false,
      code: "INVALID_NAME_TYPE",
      message: "SKILL.md 'name' field must be a string",
    };
  }

  const name = data.name;

  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      code: "INVALID_NAME_LENGTH",
      message: `SKILL.md name '${name}' must be between 1 and ${MAX_NAME_LENGTH} characters (got ${name.length})`,
    };
  }

  if (!NAME_PATTERN.test(name)) {
    let detail = "must contain only lowercase letters, numbers, and hyphens (no leading, trailing, or consecutive hyphens)";
    if (/[A-Z]/.test(name)) {
      detail = "uppercase letters are not allowed";
    } else if (name.startsWith("-")) {
      detail = "cannot start with a hyphen";
    } else if (name.endsWith("-")) {
      detail = "cannot end with a hyphen";
    } else if (name.includes("--")) {
      detail = "cannot contain consecutive hyphens";
    }
    return {
      ok: false,
      code: "INVALID_NAME_PATTERN",
      message: `SKILL.md name '${name}' is invalid: ${detail}`,
    };
  }

  if (parentDirBasename && parentDirBasename !== name) {
    return {
      ok: false,
      code: "NAME_DIRECTORY_MISMATCH",
      message: `SKILL.md name '${name}' does not match parent directory '${parentDirBasename}'`,
    };
  }

  // Validate 'description'
  if (!("description" in data) || data.description === undefined || data.description === null) {
    return {
      ok: false,
      code: "MISSING_DESCRIPTION",
      message: "SKILL.md is missing required 'description' field in frontmatter",
    };
  }

  if (typeof data.description !== "string") {
    return {
      ok: false,
      code: "INVALID_DESCRIPTION_TYPE",
      message: "SKILL.md 'description' field must be a string",
    };
  }

  const description = data.description;
  if (description.trim().length === 0) {
    return {
      ok: false,
      code: "EMPTY_DESCRIPTION",
      message: "SKILL.md 'description' field must not be empty",
    };
  }

  const byteLength = new TextEncoder().encode(description).length;
  if (byteLength > MAX_DESCRIPTION_BYTES) {
    return {
      ok: false,
      code: "DESCRIPTION_TOO_LONG",
      message: `SKILL.md description exceeds ${MAX_DESCRIPTION_BYTES} bytes (got ${byteLength})`,
    };
  }

  // Build metadata object with extras
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (
      k !== "name" &&
      k !== "description" &&
      k !== "license" &&
      k !== "compatibility" &&
      k !== "metadata" &&
      k !== "allowed-tools" &&
      k !== "allowedTools"
    ) {
      extras[k] = v;
    }
  }

  const metadata: SkillMetadata = {
    name,
    description: description.trim(),
    license: typeof data.license === "string" ? data.license : undefined,
    compatibility: data.compatibility,
    metadata: data.metadata,
    allowedTools: data["allowed-tools"] ?? data.allowedTools,
    extras,
  };

  return {
    ok: true,
    metadata,
  };
}

export function validateSkillContent(
  rawSkillMd: string,
  parentDirBasename?: string
): ValidationResult {
  try {
    const { data } = extractFrontmatter(rawSkillMd);
    return validateSkillMetadata(data, parentDirBasename);
  } catch (err) {
    if (err instanceof ValidationError) {
      return {
        ok: false,
        code: err.code as ValidationErrorCode,
        message: err.message,
      };
    }
    return {
      ok: false,
      code: "INVALID_YAML",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
