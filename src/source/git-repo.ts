import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { SourceResolver, SourceResult } from "./resolver.ts";
import { SourceError } from "../errors.ts";

export class GitRepoResolver implements SourceResolver {
  readonly name = "GitRepoResolver";

  canHandle(source: string): boolean {
    const s = source.toLowerCase();
    if (s.startsWith("git+") || s.startsWith("ssh://git@") || s.startsWith("git://")) {
      return true;
    }
    if (s.endsWith(".git") || s.includes(".git?")) {
      return true;
    }
    if (s.startsWith("http://") || s.startsWith("https://")) {
      // DirectSkillFileResolver takes precedence in the chain
      return true;
    }
    return false;
  }

  async isGitAvailable(): Promise<boolean> {
    try {
      const proc = Bun.spawn(["git", "--version"], {
        stdout: "ignore",
        stderr: "ignore",
      });
      const code = await proc.exited;
      return code === 0;
    } catch {
      return false;
    }
  }

  async resolve(source: string): Promise<SourceResult> {
    let cloneUrl = source;
    if (cloneUrl.startsWith("git+")) {
      cloneUrl = cloneUrl.slice(4);
    }

    // Try fast tarball download for GitHub HTTPS URLs
    if (cloneUrl.startsWith("https://github.com/") || cloneUrl.startsWith("http://github.com/")) {
      try {
        const url = new URL(cloneUrl);
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          const owner = parts[0];
          const cleanRepo = parts[1].replace(/\.git$/, "");
          const tarUrl = `https://codeload.github.com/${owner}/${cleanRepo}/tar.gz/HEAD`;

          const res = await fetch(tarUrl, { headers: { "User-Agent": "skill-cli" } });
          if (res.ok && res.body) {
            const tempDir = await mkdtemp(join(tmpdir(), "skill-tar-"));
            const tarFile = join(tempDir, "archive.tar.gz");
            const buf = await res.arrayBuffer();
            await Bun.write(tarFile, buf);

            const proc = Bun.spawn(
              ["tar", "-xzf", tarFile, "-C", tempDir, "--strip-components=1"],
              { stdout: "ignore", stderr: "ignore" }
            );
            const code = await proc.exited;
            await rm(tarFile, { force: true }).catch(() => {});

            if (code === 0) {
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
        }
      } catch {
        // Fallback to git clone
      }
    }

    const gitOk = await this.isGitAvailable();
    if (!gitOk) {
      throw new SourceError(
        "GIT_NOT_FOUND",
        "git is required for repository sources but was not found on PATH"
      );
    }

    const tempDir = await mkdtemp(join(tmpdir(), "skill-git-"));

    let proc;
    let stderrPromise: Promise<string>;

    try {
      proc = Bun.spawn(
        [
          "git",
          "clone",
          "--depth",
          "1",
          "--single-branch",
          "--no-tags",
          "--",
          cloneUrl,
          tempDir,
        ],
        {
          stdin: "ignore",
          stdout: "ignore",
          stderr: "pipe",
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: "0",
          },
        }
      );
      stderrPromise = new Response(proc.stderr).text();
    } catch (err) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      throw new SourceError(
        "GIT_SPAWN_FAILED",
        `failed to execute git clone: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const [exitCode, stderrText] = await Promise.all([
      proc.exited,
      stderrPromise,
    ]);

    if (exitCode !== 0) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      throw new SourceError(
        "GIT_CLONE_FAILED",
        `failed to clone repository: ${stderrText.trim()}`
      );
    }

    return {
      type: "directory",
      tempDir,
      cleanup: async () => {
        try {
          await rm(tempDir, { recursive: true, force: true });
        } catch {
          // ignore cleanup errors
        }
      },
    };
  }
}
