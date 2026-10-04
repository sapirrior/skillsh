export class SkillxError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "SkillxError";
  }
}

export class SourceError extends SkillxError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "SourceError";
  }
}

export class ValidationError extends SkillxError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "ValidationError";
  }
}

export class InstallError extends SkillxError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "InstallError";
  }
}

export class CatalogError extends SkillxError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "CatalogError";
  }
}
