import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { SourceResolver, SourceResult } from "./resolver.ts";
import { SourceError } from "../errors.ts";
import { validateSkillContent } from "../skill/validator.ts";

export const SKILL_MD_MAX_BYTES = 524_288; // 512 KB

export class DirectSkillFileResolver implements SourceResolver {
  readonly name = "DirectSkillFileResolver";

  canHandle(source: string): boolean {
    if (!source.startsWith("http://") && !source.startsWith("https://")) {
      return false;
    }

    try {
      const url = new URL(source);
      const pathname = url.pathname.toLowerCase();
      return pathname.endsWith("/skill.md") || pathname === "skill.md";
    } catch {
      return false;
    }
  }

  async resolve(source: string): Promise<SourceResult> {
    let res: Response;
    try {
      res = await fetch(source, {
        headers: {
          Accept: "text/plain, text/markdown, */*",
        },
      });
    } catch (err) {
      throw new SourceError(
        "FETCH_FAILED",
        `Failed to fetch '${source}': ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!res.ok) {
      throw new SourceError(
        "HTTP_ERROR",
        `HTTP ${res.status}: ${source}`
      );
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.toLowerCase().includes("text/html")) {
      throw new SourceError(
        "HTML_RESPONSE",
        "source URL returned HTML content; direct SKILL.md URL required"
      );
    }

    const text = await res.text();
    const byteLength = new TextEncoder().encode(text).length;
    if (byteLength > SKILL_MD_MAX_BYTES) {
      throw new SourceError(
        "FILE_TOO_LARGE",
        `SKILL.md exceeds maximum allowed size of ${SKILL_MD_MAX_BYTES} bytes (got ${byteLength})`
      );
    }

    // Validate frontmatter and extract name
    const validation = validateSkillContent(text);
    if (!validation.ok) {
      throw new SourceError("INVALID_SKILL_MD", validation.message);
    }

    const skillName = validation.metadata.name;

    // Create temp directory: <tmpDir>/<name>/SKILL.md
    const baseTempDir = await mkdtemp(join(tmpdir(), "skillx-direct-"));
    const skillDir = join(baseTempDir, skillName);
    await mkdir(skillDir, { recursive: true });

    const skillFilePath = join(skillDir, "SKILL.md");
    await writeFile(skillFilePath, text, "utf8");

    return {
      type: "skill-file",
      skillFilePath,
      tempDir: baseTempDir,
      cleanup: async () => {
        try {
          await rm(baseTempDir, { recursive: true, force: true });
        } catch {
          // ignore cleanup errors
        }
      },
    };
  }
}
