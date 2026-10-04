import type { SourceResolver, SourceResult } from "./resolver.ts";
import { GitRepoResolver } from "./git-repo.ts";

/**
 * Resolves GitHub shorthand strings (e.g. 'owner/repo', 'vercel-labs/skills')
 * by translating them to 'https://github.com/owner/repo.git' and delegating to GitRepoResolver.
 */
export class GitHubShorthandResolver implements SourceResolver {
  readonly name = "GitHubShorthandResolver";
  private gitResolver: GitRepoResolver;

  constructor(gitResolver = new GitRepoResolver()) {
    this.gitResolver = gitResolver;
  }

  canHandle(source: string): boolean {
    const trimmed = source.trim();
    // Exclude URLs, schemes, and local paths
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

    // Match owner/repo pattern (alphanumeric, hyphens, underscores, dots)
    const match = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
    return match !== null;
  }

  async resolve(source: string): Promise<SourceResult> {
    const trimmed = source.trim();
    const [owner, repo] = trimmed.split("/");
    const normalizedRepo = repo.endsWith(".git") ? repo : `${repo}.git`;
    const gitUrl = `https://github.com/${owner}/${normalizedRepo}`;

    return this.gitResolver.resolve(gitUrl);
  }
}
