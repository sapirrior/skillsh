import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { SourceResolver, SourceResult } from "./resolver.ts";
import { GitRepoResolver } from "./git-repo.ts";

/**
 * Resolves GitHub shorthand strings (e.g. 'owner/repo', 'vercel-labs/skills')
 * using fast HTTP streaming tarball downloads with automatic fallback to Git clone.
 */
export class GitHubShorthandResolver implements SourceResolver {
  readonly name = "GitHubShorthandResolver";
  private gitResolver: GitRepoResolver;

  constructor(gitResolver = new GitRepoResolver()) {
    this.gitResolver = gitResolver;
  }

  canHandle(source: string): boolean {
    const trimmed = source.trim();
    if (
      trimmed.includes("://") ||
      trimmed.startsWith("./") ||
      trimmed.startsWith("../") ||
      trimmed.startsWith("/") ||
      trimmed.startsWith("~") ||
      trimmed.startsWith("git@")
    ) {
      return false;
    }

    const match = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
    return match !== null;
  }

  async resolve(source: string): Promise<SourceResult> {
    const trimmed = source.trim();
    const [owner, rawRepo] = trimmed.split("/");
    const cleanRepo = rawRepo.replace(/\.git$/, "");
    const gitUrl = `https://github.com/${owner}/${cleanRepo}.git`;

    // Try fast HTTP tarball download first (instant vs slow git packfile transfer)
    try {
      const tarUrl = `https://codeload.github.com/${owner}/${cleanRepo}/tar.gz/HEAD`;
      const res = await fetch(tarUrl, {
        headers: { "User-Agent": "skill-cli" },
      });

      if (res.ok && res.body) {
        const tempDir = await mkdtemp(join(tmpdir(), "skill-gh-"));
        const tarFile = join(tempDir, "archive.tar.gz");

        const buf = await res.arrayBuffer();
        await Bun.write(tarFile, buf);

        const proc = Bun.spawn(
          ["tar", "-xzf", tarFile, "-C", tempDir, "--strip-components=1"],
          {
            stdout: "ignore",
            stderr: "ignore",
          }
        );
        const exitCode = await proc.exited;
        await rm(tarFile, { force: true }).catch(() => {});

        if (exitCode === 0) {
          return {
            type: "directory",
            tempDir,
            cleanup: async () => {
              try {
                await rm(tempDir, { recursive: true, force: true });
              } catch {}
            },
          };
        } else {
          await rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
      }
    } catch {
      // Fallback to git clone below
    }

    // Fallback to GitRepoResolver (handles SSH, credentials, private repos, etc.)
    return this.gitResolver.resolve(gitUrl);
  }
}
