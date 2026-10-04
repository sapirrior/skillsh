import { describe, it, expect } from "bun:test";
import { DirectSkillFileResolver } from "../../src/source/direct-skill.ts";
import { GitRepoResolver } from "../../src/source/git-repo.ts";
import { GitHubShorthandResolver } from "../../src/source/github-shorthand.ts";
import { ResolverChain } from "../../src/source/resolver.ts";

describe("Source Resolvers Classification", () => {
  const directResolver = new DirectSkillFileResolver();
  const gitResolver = new GitRepoResolver();
  const githubResolver = new GitHubShorthandResolver(gitResolver);

  it("classifies direct SKILL.md URLs", () => {
    expect(directResolver.canHandle("https://example.com/SKILL.md")).toBe(true);
    expect(directResolver.canHandle("https://example.com/skills/rust/SKILL.md")).toBe(true);
    expect(directResolver.canHandle("https://example.com/skills/rust/other.md")).toBe(false);
  });

  it("classifies GitHub shorthand owner/repo", () => {
    expect(githubResolver.canHandle("vercel/ai")).toBe(true);
    expect(githubResolver.canHandle("vercel-labs/skills")).toBe(true);
    expect(githubResolver.canHandle("anthropics/skills")).toBe(true);
    expect(githubResolver.canHandle("https://github.com/vercel/ai")).toBe(false);
    expect(githubResolver.canHandle("./local/path")).toBe(false);
  });

  it("classifies git repo URLs", () => {
    expect(gitResolver.canHandle("https://github.com/example/skills.git")).toBe(true);
    expect(gitResolver.canHandle("git@github.com:example/skills.git")).toBe(true);
    expect(gitResolver.canHandle("git+https://example.com/skills.git")).toBe(true);
    expect(gitResolver.canHandle("ssh://git@example.com/org/repo.git")).toBe(true);
    expect(gitResolver.canHandle("https://github.com/example/skills")).toBe(true);
  });

  it("prioritizes direct SKILL.md in resolver chain", async () => {
    const chain = new ResolverChain();
    chain.register(directResolver);
    chain.register(githubResolver);
    chain.register(gitResolver);

    // Rejects local path
    expect(chain.resolve("./local-skill")).rejects.toThrow();
  });
});
