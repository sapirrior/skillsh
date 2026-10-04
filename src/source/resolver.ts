import { SourceError } from "../errors.ts";

export interface SourceResult {
  type: "skill-file" | "directory";
  skillFilePath?: string;
  tempDir?: string;
  /** Cleanup temporary acquisition directory on both success and failure */
  cleanup(): Promise<void>;
}

export interface SourceResolver {
  readonly name: string;
  canHandle(source: string): boolean;
  resolve(source: string): Promise<SourceResult>;
}

export class ResolverChain {
  private resolvers: SourceResolver[] = [];

  register(resolver: SourceResolver): this {
    this.resolvers.push(resolver);
    return this;
  }

  async resolve(source: string): Promise<{ result: SourceResult; resolverName: string }> {
    const trimmed = source.trim();
    if (!trimmed) {
      throw new SourceError("EMPTY_SOURCE", "Source argument cannot be empty");
    }

    if (
      trimmed.startsWith("./") ||
      trimmed.startsWith("../") ||
      trimmed.startsWith("/") ||
      trimmed.startsWith("~")
    ) {
      throw new SourceError(
        "UNSUPPORTED_LOCAL_SOURCE",
        `unrecognized source format: '${source}'\n       supported sources: HTTPS SKILL.md URL, Git repository URL (.git)`
      );
    }

    for (const resolver of this.resolvers) {
      if (resolver.canHandle(trimmed)) {
        const result = await resolver.resolve(trimmed);
        return { result, resolverName: resolver.name };
      }
    }

    throw new SourceError(
      "UNRECOGNIZED_SOURCE",
      `unrecognized source format: '${source}'\n       supported sources: HTTPS SKILL.md URL, Git repository URL (.git)`
    );
  }
}
