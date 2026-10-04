# PLAN: `skillx` — The Open Standard Agent Skills CLI

**Stack:** TypeScript · Bun 1.4+  
**Audience:** Implementation agent / senior engineer  
**Role:** Execute this plan as a production-minded engineer. Inspect the repository before editing anything. Do not guess current structure, APIs, or existing abstractions.  
**Research cutoff:** 2026-10-04  
**Design priority:** correctness → standards compliance → open extensibility → simplicity → predictable behavior → maintainability → small dependency footprint

> **Aspiration:** `skillx` should become the de-facto open-standard CLI for acquiring, validating, and locally discovering Agent Skills — in the same way `curl` is the de-facto standard for HTTP on the command line. It is not a package manager. It is a standards-first acquisition and catalog tool.

---

## 0. Mission

Build `skillx` as a **small, protocol-first, extensible Agent Skills acquisition and local discovery CLI**.

`skillx` is **not** a package manager, dependency manager, agent manager, marketplace client, update manager, or agent-specific integration framework.

The core lifecycle is intentionally tiny but the architecture must be open to extension without modification:

```
skillx add <source> [--skill <name>]
        │
        ├─ resolve source → SourceResult
        ├─ locate valid Agent Skills (handles 0, 1, N)
        ├─ validate required standard metadata
        ├─ copy the complete skill directory
        │      → ~/.agents/skills/<skill-name>/
        └─ record acquisition
               → ~/.skillx/skill.lock  (JSON)

skillx search <query>
        └─ search ~/.skillx/skill.lock  (local only, scored)

skillx list
        └─ list ~/.skillx/skill.lock  (sorted, plain text)
```

The installed skill remains an ordinary Agent Skill. An agent must not need `skillx` to understand or execute it.

---

## 1. Verified Research Basis

**Date verified:** 2026-10-04  
**Toolchain verified:** Bun 1.4.2, Node 24.21.0, git 2.47.3

### 1.1 Agent Skills Standard — Verified Facts

A skill is a directory containing at minimum `SKILL.md`. Optional content: `scripts/`, `references/`, `assets/`, any other files. `SKILL.md` contains YAML frontmatter followed by Markdown instructions.

Required frontmatter fields: `name`, `description`.  
Optional fields: `license`, `compatibility`, `metadata`, experimental `allowed-tools`.

`name` constraints (from specification):
- 1–64 characters
- lowercase letters, digits, hyphens only
- no leading hyphen
- no trailing hyphen
- no consecutive hyphens
- must match the parent directory basename

`description` constraints:
- non-empty
- max 1024 characters

The specification does **not** define: a universal package-manager protocol, a global install directory, Git source resolution, GitHub shorthand, version semantics, update semantics, or marketplace discovery.

### 1.2 What Is NOT Standardized

Do not claim these are part of the Agent Skills protocol:
- `~/.agents/skills/`
- `~/.skillx/skill.lock`
- GitHub shorthand (`owner/repo`)
- Git repository source resolution
- Package/version semantics
- Update, upgrade, remove semantics
- Agent detection or agent link management

These are `skillx`-specific policies. They must be clearly separated from the skill format itself.

### 1.3 Common `.agents/skills/` Convention

The Agent Skills ecosystem commonly uses `.agents/skills/`. The current Agent Skills quickstart documents `.agents/skills/` as the default skills location for VS Code and many other agents. Therefore `skillx` uses:

```
~/.agents/skills/<skill-name>/
```

as its **chosen global installation target**. Documentation must describe this as `skillx`'s installation policy, not a normative requirement of the specification.

### 1.4 Why TypeScript + Bun

- **Bun** provides native `fetch`, file I/O, subprocess (`Bun.spawn`), test runner, and `bun build` — zero extra runtime deps for core operations.
- **TypeScript** enables strong typing across the plugin/extension boundary — essential for an open-standard tool that must support community-contributed source resolvers and validators.
- JSON is TypeScript's native format — `skill.lock` round-trips with zero overhead, is human-readable, and is trivially consumed by other tools.
- The combination produces a fast, single-file-compilable binary via `bun build --compile`.

---

## 2. Non-Negotiable Design Principles

### P1. Protocol Standard Over Vendor Definition

When the Agent Skills standard defines something, follow that definition. When the standard does not define something, choose the smallest understandable behavior needed by `skillx`. Never invent a second skill format.

### P2. The Skill Owns Its Identity

The canonical skill identity comes from the standard `SKILL.md` `name` field. Do not derive the installed name from a repository name, GitHub owner, URL basename, npm package name, or any vendor-specific convention when valid `SKILL.md` metadata exists. The standard also requires `name` to match the parent directory name. Validate this.

### P3. Open/Closed Principle — Extensible Without Modification

The architecture must follow the Open/Closed Principle:

- **Source resolvers** can be added without modifying the core `add` command.
- **Validators** can be extended (e.g., per-spec-version rules) without changing the parser.
- **Output formatters** can be swapped without touching business logic.
- **Catalog backends** can be replaced without touching the search/list commands.

All extension points use TypeScript interfaces, not inheritance hierarchies.

### P4. `skillx` Does Not Own the Lifecycle

Do not implement: update, upgrade, remove, dependency resolution, version ranges, Git commit pinning, integrity hashes, remote freshness checks, migration state, agent link management, or marketplace synchronization.

A user can manage the installed directory using normal filesystem tooling. This is intentional.

### P5. Local Search Means Local Search

`skillx search` searches the local `~/.skillx/skill.lock` catalog only. It must not silently contact any website, GitHub, registry, or remote search service.

### P6. Install the Entire Skill Directory Unchanged

Parse `SKILL.md` to understand and validate the skill, but do not rewrite it. Copy the complete selected skill directory including scripts, references, assets, and other files. Preserve all content exactly.

### P7. Fail Safely

- Never overwrite an existing destination by default.
- Never execute skill scripts during installation.
- Never leave a partially installed skill when the operation fails.
- Rollback on any failure during or after copy.

### P8. Dependency Restraint

Bun's standard library covers: fetch, file I/O, subprocess, temp dirs, test runner. Do not add a framework for any of these. External packages are only justified when Bun's built-ins are genuinely insufficient.

### P9. Inspect First, Then Implement

Before changing any code, the implementation agent must inspect:
1. `package.json` / workspace manifest(s)
2. Current source tree
3. Current binary entry point(s)
4. Existing tests
5. Existing error/CLI conventions
6. Existing dependencies

Only after that inspection should exact file paths be chosen.

---

## 3. Final Command Surface

Keep the public CLI to three meaningful commands plus standard meta-flags.

```
skillx add <source> [--skill <name>]
skillx search <query>
skillx list

skillx --help
skillx --version
```

### 3.1 `skillx add`

Purpose: acquire and install one Agent Skill from a source.

```bash
# Direct SKILL.md URL
skillx add https://example.com/SKILL.md

# Git repository (single skill)
skillx add https://github.com/example/skills.git

# Git repository (multi-skill — requires disambiguation)
skillx add https://github.com/example/skills.git --skill code-review

# GitLab
skillx add https://gitlab.com/example/skills.git

# SSH Git
skillx add ssh://git@git.example.com/org/skills.git
```

**Disambiguation edge cases — all must be handled:**

| Scenario | Behavior |
|---|---|
| 0 valid skills found | Error: clear message, no install |
| 1 valid skill found | Auto-select and install |
| N valid skills, no `--skill` | Error: list available names+descriptions, exit non-zero |
| N valid skills, `--skill <name>` given | Select by parsed `name`, install |
| `--skill <name>` given but name not found | Error: show available names |
| `--skill <name>` given, single skill, name matches | Install normally |
| `--skill <name>` given, single skill, name mismatches | Error |
| Source is ambiguous (could be URL or git) | Apply classification rules (see §4.3) |

**Semantics:**
1. Classify and resolve the source via the Source Resolver chain.
2. Acquire into a temporary workspace.
3. Discover all valid Agent Skill directories.
4. Apply disambiguation logic per the table above.
5. Validate the selected skill against the standard.
6. Reject if `~/.agents/skills/<name>/` already exists.
7. Copy the entire skill directory atomically.
8. Update `~/.skillx/skill.lock` only after install is complete.
9. If lock-file persistence fails, remove the newly-created destination and report failure.
10. Clean up the temporary acquisition directory on success and failure.

Do not add `--agent`, `--global`, `--copy`, `--all`, `--yes`, `--owner`, `--update`, or equivalent flags.

### 3.2 `skillx search`

Purpose: rediscover skills already recorded in `skill.lock`.

```bash
skillx search rust
skillx search "code review"
skillx search --json rust        # machine-readable output
```

Search fields: skill `name`, skill `description`. Case-insensitive.

Implement a small deterministic scorer in TypeScript. No fuzzy-search package. Support in priority order:
1. Exact name match (score 100)
2. Name prefix match (score 80)
3. Name substring match (score 60)
4. All query tokens present in name (score 55)
5. Description exact phrase match (score 50)
6. All query tokens in description (score 40)
7. Partial token matches in name+description (score 20)
8. Simple subsequence match as final fallback (score 10)

Tie-break deterministically: higher score → shorter name → lexicographic name.

No network calls. No interactive TUI. No `--owner` or remote filters.

### 3.3 `skillx list`

Purpose: list every skill recorded in `~/.skillx/skill.lock`.

```bash
skillx list
skillx list --json               # machine-readable output
```

Display:
```
name           description
─────────────────────────────────────────────────
code-review    Review code for correctness…
rust           Rust development guidance…
```

Sort by name (deterministic). `--json` emits the raw catalog array. The command reads the local catalog only — no filesystem scans of agent directories.

---

## 4. Source Model

The source layer is built as an **open chain of resolvers**. Each resolver implements a TypeScript interface and is tried in order. New resolvers can be added without modifying existing ones (OCP).

### 4.1 `SourceResolver` Interface

```typescript
interface SourceResult {
  type: "skill-file" | "directory";
  // For "skill-file": a single SKILL.md path on disk
  skillFilePath?: string;
  // For "directory": a temp dir containing one or more skills
  tempDir?: string;
  /** Called by the orchestrator after install — must clean up tempDir */
  cleanup(): Promise<void>;
}

interface SourceResolver {
  /** Return true if this resolver can handle the given source string */
  canHandle(source: string): boolean;
  /** Resolve the source and return a SourceResult */
  resolve(source: string): Promise<SourceResult>;
}
```

The resolver chain is evaluated in registration order. The first resolver that returns `canHandle = true` is used.

### 4.2 Built-in Resolvers (v1)

#### A. `DirectSkillFileResolver`

Handles: HTTPS URLs ending in `/SKILL.md` (case-insensitive basename match).

```
https://example.com/skills/code-review/SKILL.md
https://raw.githubusercontent.com/example/skills/main/SKILL.md
```

Behavior:
- `fetch()` the URL (native Bun fetch).
- Require HTTP 2xx response.
- Enforce a conservative body size limit (`SKILL_MD_MAX_BYTES = 524_288` — 512 KB constant).
- Parse body as `SKILL.md`.
- Create one temporary directory with the downloaded file as `SKILL.md`.
- Return `type: "skill-file"`.

Do not rewrite downloaded frontmatter. Do not accept HTML content-type masquerading as `SKILL.md`.

#### B. `GitRepoResolver`

Handles: any URL not handled by A that ends in `.git`, starts with `git+`, uses `ssh://git@`, or uses `git://`.

```
https://github.com/example/skills.git
https://gitlab.com/example/skills.git
ssh://git@git.example.com/org/skills.git
git+https://example.com/skills.git
```

Behavior:
- Invoke local `git` with `clone --depth 1 -- <url> <tempDir>` using `Bun.spawn`. Pass arguments as an array — never interpolate into a shell string.
- Allow Git to handle authentication, SSH agents, credential helpers.
- Do not embed any provider-specific authentication logic.
- Capture stderr for error reporting.
- Return `type: "directory"` with the temp dir path.
- Cleanup removes the temp dir on both success and failure.

Check `git` availability before attempting clone:
```
error: git is required for repository sources but was not found on PATH
```

#### C. `HttpDirectoryResolver` *(v1 — future hook only)*

Reserved interface slot for acquiring a skill from a `.zip` or `.tar.gz` archive URL. **Not implemented in v1.** The slot exists so v2 can add it without modifying A or B.

### 4.3 Source Classification Rules

Apply these rules in order to classify any input string:

| Priority | Pattern | Resolver |
|---|---|---|
| 1 | URL, basename (case-insensitive) is `SKILL.md` | `DirectSkillFileResolver` |
| 2 | Ends in `.git` | `GitRepoResolver` |
| 3 | Starts with `git+` | `GitRepoResolver` |
| 4 | Starts with `ssh://git@` | `GitRepoResolver` |
| 5 | Starts with `git://` | `GitRepoResolver` |
| 6 | Valid HTTPS/HTTP URL | `GitRepoResolver` (treat as bare git URL, git will reject non-repos gracefully) |
| 7 | No resolver matched | Error: unrecognized source format |

### 4.4 Edge Cases the Source Layer Must Handle

| Edge Case | Behavior |
|---|---|
| URL with query params: `?ref=main` | Strip for classification; pass full URL to resolver |
| URL with fragment: `#main` | Strip fragment; pass bare URL |
| Mixed-case `.GIT` suffix | Normalize to lowercase before classification |
| Redirect chain ending at SKILL.md | Follow redirects (Bun fetch follows by default); validate final content-type |
| Redirect to HTML page | Reject — content-type must not be `text/html` |
| GitHub URL without `.git` suffix | Falls through to rule 6; git clone attempt will work because GitHub accepts both |
| Private repo requiring auth | Pass through to Git; let git handle credentials |
| Empty source string | Error immediately before resolver chain |
| Source is a local path (`./`, `/`, `~`) | Error: local paths are out of scope for v1 |

### 4.5 Explicitly Out of Scope for v1

Do not implement:
- GitHub `owner/repo` shorthand
- GitHub API discovery or tree APIs
- GitLab/Azure provider-specific APIs
- `skills.sh` discovery
- GitHub CLI token extraction
- Archive URLs (`.zip`, `.tar`, `.tar.gz`, `.tgz`) — reserved slot only
- npm packages as skill sources
- Arbitrary local paths
- Web page scraping
- Registry files
- Dependency metadata

These can be added as new resolvers in future versions without modifying existing code.

---

## 5. Agent Skills Validation Contract

The selected skill must satisfy the full current standard structure. Validation is a dedicated layer — never inlined into acquisition or installation.

### 5.1 Directory Rules

```
<skill-root>/
└── SKILL.md       ← required
scripts/            ← optional
references/         ← optional
assets/             ← optional
```

The root directory's basename must exactly equal the parsed `name` field. This is a hard validation failure, not a warning.

### 5.2 `SKILL.md` Frontmatter Rules

- File must exist and be readable.
- Must begin with `---` on the first line (YAML frontmatter opening delimiter).
- Must have a closing `---` delimiter.
- Between delimiters must be valid YAML.
- Required keys: `name`, `description`.
- Unknown frontmatter keys must be preserved and must not cause rejection.

`name` validation:
- Type: string (not null, not number, not boolean)
- Length: 1–64 characters
- Pattern: `^[a-z0-9]+(-[a-z0-9]+)*$`
- No leading hyphen
- No trailing hyphen
- No consecutive hyphens
- Must exactly match the parent directory basename
- Mismatch with directory name → hard error with specific message

`description` validation:
- Type: string
- Non-empty (not just whitespace)
- Max 1024 characters (byte count, not codepoints)

### 5.3 Optional Frontmatter

Parse but do not enforce:
- `license` — preserve as-is
- `compatibility` — preserve as-is
- `metadata` — preserve as-is
- `allowed-tools` — preserve as-is (experimental)

Do not reject unknown keys. The standard permits extensible metadata.

### 5.4 Validation Error Taxonomy

Every validation error must be one of a named type so callers can handle them programmatically:

```typescript
type ValidationErrorCode =
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
```

Return a structured result, not a thrown string:

```typescript
type ValidationResult =
  | { ok: true; metadata: SkillMetadata }
  | { ok: false; code: ValidationErrorCode; message: string };
```

### 5.5 `SkillCandidate` and `SkillMetadata`

```typescript
interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  compatibility?: unknown;
  metadata?: unknown;
  allowedTools?: unknown;
  /** All other frontmatter keys preserved verbatim */
  extras: Record<string, unknown>;
}

interface SkillCandidate {
  /** Absolute path to the skill root directory */
  skillRoot: string;
  /** Absolute path to SKILL.md */
  skillFile: string;
  /** Parsed and validated metadata */
  metadata: SkillMetadata;
}
```

---

## 6. Discovery Layer

Given a local directory (the acquired source root), discover all valid Agent Skill directories.

### 6.1 Algorithm

```
walk(dir):
  for each entry in readdir(dir):
    if entry.name === ".git" → skip
    if entry is a symlink → record warning, skip
    if entry.name === "SKILL.md" && entry is a file:
      validate parent directory as a skill root
      if valid → add to candidates
    if entry is a directory → recurse
```

### 6.2 Requirements

- Skip `.git` at every level.
- Do not follow symlinks that leave the source tree.
- Validate every discovered `SKILL.md` — invalid ones are noted but do not halt discovery.
- Return candidates sorted by their relative path from the source root (deterministic).
- Return a `DiscoveryReport` that includes both valid candidates and invalid-but-found entries (for useful error messages).

```typescript
interface DiscoveryReport {
  valid: SkillCandidate[];
  invalid: Array<{ path: string; reason: string }>;
}
```

### 6.3 Discovery Edge Cases

| Edge Case | Behavior |
|---|---|
| Zero `SKILL.md` files found | `valid: []` — caller emits "no valid Agent Skill found" |
| `SKILL.md` at root level | Valid candidate if root dir name equals parsed `name` |
| `SKILL.md` deeply nested (3+ levels) | Valid — depth is not constrained by the standard |
| `SKILL.md` with invalid frontmatter | Goes into `invalid[]`, not `valid[]` |
| Two `SKILL.md` in the same directory | Impossible (only one file per name per dir); no special case |
| `SKILL.md` is a directory, not a file | Skip |
| Circular symlinks | Detect via visited-inodes set; skip |
| Source dir is itself a single skill | Valid — `valid[0].skillRoot === sourceRoot` |
| Name field matches dir name after case normalization | Still invalid — match must be exact (lowercase already) |

---

## 7. Installation Target

Use exactly:

```
~/.agents/skills/<skill-name>/
```

Resolve `~` using Node/Bun `os.homedir()`. Do not manually concatenate path separators. Use `path.join()` everywhere.

Create parent directories as needed. Do not detect installed agents. Do not install to multiple agent-specific directories. Do not create symlink farms.

### 7.1 Installer Safety Rules

**S1 — Never overwrite an existing skill directory**  
If `~/.agents/skills/<name>/` already exists, fail with:
```
error: skill '<name>' is already installed at ~/.agents/skills/<name>
       to reinstall, remove the directory manually first
```

**S2 — No path escape**  
During recursive copy, compute each source-relative path and reject any that resolve outside the selected skill root. Symlinks that point outside the skill root are rejected (hard error, not a warning).

**S3 — Never execute skill content**  
Installing a skill must never run shell scripts, Python, JS, binaries, Git hooks, or package manager scripts.

**S4 — Transaction invariant**  
After `skillx add` exits successfully:
```
skill directory exists
AND
skill.lock contains the corresponding entry
```

After `skillx add` exits unsuccessfully:
```
no new skill directory created by that invocation
```

If the directory copy succeeds but the lock write fails → remove the newly created directory → exit with error.

**S5 — Rollback on partial copy**  
If any file copy fails mid-copy, remove the partially-created destination before reporting the error.

### 7.2 Recursive Copy Algorithm

```typescript
async function copySkillDir(src: string, dest: string): Promise<void> {
  // 1. Create dest directory
  // 2. Read entries of src
  // 3. For each entry:
  //    - If symlink → reject (error)
  //    - If file → copy with Bun.file() read + write
  //    - If directory → recurse
  // 4. On any error → throw (caller handles rollback)
}
```

Use only Bun/Node built-in APIs. No `fs-extra`, no `ncp`, no external copy utilities.

---

## 8. Local Catalog: `~/.skillx/skill.lock`

### 8.1 File Location

```
~/.skillx/skill.lock
```

Fixed path. Do not rename to `skills.lock`, `skills.json`, `index.json`, or any other name.

### 8.2 Format — JSON

Use JSON because:
- TypeScript/Bun parses and serializes JSON natively with zero overhead.
- JSON is universally readable and writable by other tools.
- The catalog is simple enough that JSON's lack of comments is not a problem (a `_comment` key is available if needed).
- TOML would require a dependency; JSON does not.

Canonical schema:

```json
{
  "format": 1,
  "skills": [
    {
      "name": "code-review",
      "description": "Review code for correctness, maintainability, and common defects.",
      "source": "https://github.com/example/skills.git",
      "path": "skills/code-review",
      "addedAt": "2026-10-04T14:00:00Z"
    },
    {
      "name": "rust",
      "description": "Rust development guidance and idiomatic implementation practices.",
      "source": "https://example.com/rust/SKILL.md",
      "addedAt": "2026-10-04T15:00:00Z"
    }
  ]
}
```

**Field rules:**

| Field | Required | Notes |
|---|---|---|
| `format` | Yes | Integer schema version (currently `1`) |
| `skills` | Yes | Array, may be empty |
| `skills[].name` | Yes | Parsed `name` from `SKILL.md` |
| `skills[].description` | Yes | Parsed `description` from `SKILL.md` |
| `skills[].source` | Yes | Original acquisition source, exactly as supplied |
| `skills[].path` | No | Relative path within repo when source is a Git repo |
| `skills[].addedAt` | Yes | ISO 8601 UTC timestamp of acquisition |

No version field for skills. No Git commit SHA. No hash/integrity field. No update timestamps. No installed-agent list. No telemetry state.

### 8.3 Read Behavior

| Condition | Behavior |
|---|---|
| File does not exist | Treat as empty catalog `{format:1, skills:[]}` |
| File exists but is empty | Error: "skill.lock is empty — not valid JSON" |
| File exists, valid JSON, wrong `format` | Error: "unsupported skill.lock format version N" |
| File exists, valid JSON, missing `skills` key | Error: explicit parse error |
| File is malformed JSON | Error: report parse error, do not silently wipe |
| Duplicate `name` values | Error: report duplicated names, do not guess winner |

Do not create the file merely because `list` or `search` is invoked on an empty system.

### 8.4 Write Behavior

1. Load current catalog (read behavior above).
2. Reject impossible duplicate-name state.
3. Add exactly one record.
4. Serialize with `JSON.stringify(catalog, null, 2)` — two-space indent, deterministic key order.
5. Write to a temporary file in the same directory (`skill.lock.tmp`).
6. Rename/replace atomically using `fs.rename`.
7. Ensure `~/.skillx/` directory exists before writing.

No database. No lock daemon. No concurrent-write management beyond the rename pattern.

### 8.5 Catalog TypeScript Interface

```typescript
interface CatalogEntry {
  name: string;
  description: string;
  source: string;
  path?: string;
  addedAt: string; // ISO 8601
}

interface Catalog {
  format: number;
  skills: CatalogEntry[];
}
```

---

## 9. Search Engine

Implement a deterministic local scorer in pure TypeScript. No external fuzzy-search packages.

### 9.1 Scoring Algorithm

```typescript
function scoreEntry(entry: CatalogEntry, query: string): number {
  const q = query.toLowerCase().trim();
  const name = entry.name.toLowerCase();
  const desc = entry.description.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);

  let score = 0;

  // Tier 1: exact name match
  if (name === q) score = Math.max(score, 100);
  // Tier 2: name prefix
  else if (name.startsWith(q)) score = Math.max(score, 80);
  // Tier 3: name substring
  else if (name.includes(q)) score = Math.max(score, 60);
  // Tier 4: all tokens in name
  else if (tokens.every(t => name.includes(t))) score = Math.max(score, 55);

  // Tier 5: description exact phrase
  if (desc.includes(q)) score = Math.max(score, 50);
  // Tier 6: all tokens in description
  else if (tokens.every(t => desc.includes(t))) score = Math.max(score, 40);

  // Tier 7: partial token matches
  const partialHits = tokens.filter(t => name.includes(t) || desc.includes(t)).length;
  if (partialHits > 0) score = Math.max(score, Math.floor(20 * partialHits / tokens.length));

  // Tier 8: subsequence fallback
  if (score === 0 && isSubsequence(q, name + " " + desc)) score = 10;

  return score;
}
```

### 9.2 Sort Order

Sort by: `score DESC` → `name.length ASC` → `name ASC` (lexicographic).

Zero-score entries are excluded from results. Zero results is a successful command with a clear no-results message.

---

## 10. Architecture and Module Map

The architecture is layered into modules with clear boundaries. Each module has one responsibility and is tested independently.

```
src/
├── cli.ts               ← entry point, arg parsing (clargs or custom)
├── commands/
│   ├── add.ts           ← orchestration for skillx add
│   ├── search.ts        ← skillx search
│   └── list.ts          ← skillx list
├── source/
│   ├── resolver.ts      ← SourceResolver interface + chain runner
│   ├── direct-skill.ts  ← DirectSkillFileResolver
│   └── git-repo.ts      ← GitRepoResolver
├── skill/
│   ├── parser.ts        ← frontmatter extraction + YAML parse
│   ├── validator.ts     ← name/description validation rules
│   └── discovery.ts     ← recursive SKILL.md discovery
├── installer.ts         ← recursive copy + rollback
├── catalog/
│   ├── catalog.ts       ← Catalog read/write/validate
│   └── schema.ts        ← CatalogEntry / Catalog types
├── search/
│   └── scorer.ts        ← deterministic search scoring
├── output/
│   ├── formatter.ts     ← OutputFormatter interface
│   ├── plain.ts         ← plain text output
│   └── json.ts          ← JSON output (--json flag)
└── errors.ts            ← SkillxError hierarchy
```

### 10.1 `errors.ts` — Structured Error Hierarchy

```typescript
class SkillxError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

class SourceError extends SkillxError {}
class ValidationError extends SkillxError {}
class InstallError extends SkillxError {}
class CatalogError extends SkillxError {}
```

All errors are instances of `SkillxError`. The CLI catches `SkillxError`, prints the message (no stack trace), and exits non-zero. Unknown errors include the message but suppress the stack unless `SKILLX_DEBUG=1`.

### 10.2 `OutputFormatter` Interface (OCP Output)

```typescript
interface OutputFormatter {
  addSuccess(entry: CatalogEntry, installPath: string): void;
  searchResults(entries: Array<CatalogEntry & { score: number }>): void;
  listResults(entries: CatalogEntry[]): void;
  noResults(query?: string): void;
  error(msg: string): void;
}
```

`--json` swaps in the JSON formatter without touching any command logic.

### 10.3 CLI Argument Parsing

Use a minimal, dependency-free arg parser built on `process.argv`. Do not add `commander`, `yargs`, `meow`, or similar packages. The command surface is small enough that a purpose-built parser is simpler and more type-safe.

Required behavior:
- `skillx --help` / `skillx -h` → print help, exit 0
- `skillx --version` / `skillx -v` → print version from `package.json`, exit 0
- `skillx add <source> [--skill <name>] [--json]` → add command
- `skillx search <query> [--json]` → search command
- `skillx list [--json]` → list command
- Unknown subcommand → error, exit 1
- Missing required argument → error, exit 1

---

## 11. Safe Acquisition Workflow

### 11.1 Direct `SKILL.md` URL

```
URL
 ↓
classify → DirectSkillFileResolver
 ↓
fetch() with body size limit
 ↓
HTTP 2xx check
 ↓
content-type must not be text/html
 ↓
parse SKILL.md (frontmatter + body)
 ↓
validate name/description
 ↓
create temp dir: <tmpDir>/<name>/SKILL.md
 ↓
install → ~/.agents/skills/<name>/
 ↓
record catalog entry
 ↓
cleanup temp dir
```

### 11.2 Git Repository

```
URL
 ↓
classify → GitRepoResolver
 ↓
check git in PATH
 ↓
git clone --depth 1 -- <url> <tempDir>
 ↓
capture stderr; report failures usefully
 ↓
discovery: walk tempDir, skip .git, validate candidates
 ↓
0 candidates → error, cleanup
1 candidate → select automatically
N candidates, no --skill → error: list names, cleanup
N candidates, --skill given → select by name, cleanup others
 ↓
install selected skill dir
 ↓
record catalog entry
 ↓
cleanup temp dir
```

### 11.3 Multi-Skill Repository — Full Edge Case Matrix

| `--skill` given | Candidates found | Result |
|---|---|---|
| No | 0 | Error: no valid Agent Skill found |
| No | 1 | Auto-install the single candidate |
| No | N>1 | Error: list available names+descriptions |
| Yes, matches 1 | 1 | Install (verify name matches) |
| Yes, matches 1 of N | N | Install the matched one |
| Yes, matches 0 of N | N | Error: name not found, show available |
| Yes, but 0 candidates | 0 | Error: no valid Agent Skill found |

---

## 12. Dependency Budget

Start by checking `package.json`. Reuse existing dependencies when they provide the exact needed functionality.

### 12.1 Expected Runtime Dependencies (v1)

| Package | Why justified | Bun built-in alternative |
|---|---|---|
| None | Bun provides fetch, spawn, fs, path, os natively | — |

**Zero external runtime dependencies in v1.** Bun covers everything needed:
- HTTP: native `fetch`
- Subprocess: `Bun.spawn`
- File I/O: `Bun.file`, `fs/promises`
- Temp dirs: `fs.mkdtemp` (Node compat)
- Paths: `path` (Node compat)
- Home dir: `os.homedir()` (Node compat)
- JSON: native

### 12.2 Dev Dependencies Only

| Package | Purpose |
|---|---|
| `typescript` | Type checking |
| `@types/bun` | Bun type definitions |
| `@types/node` | Node compat type definitions |

### 12.3 Explicit Prohibitions

Do not add for v1 (unless repository inspection proves a real need):
- `commander`, `yargs`, `meow`, `clargs` — CLI parsing
- `got`, `node-fetch`, `axios` — HTTP
- `simple-git`, `isomorphic-git`, `nodegit` — Git
- `glob`, `fast-glob`, `micromatch` — filesystem traversal
- `fuse.js`, `fuzzysort`, `fuzzy` — search
- `fs-extra`, `ncp`, `cpy` — file copying
- `js-yaml`, `yaml` — YAML parsing (use minimal built-in parser)
- `zod`, `joi`, `ajv` — schema validation
- `winston`, `pino`, `debug` — logging frameworks
- Any test framework other than Bun's built-in test runner

### 12.4 YAML Frontmatter Parsing Strategy

Use a minimal inline YAML parser sufficient for the Agent Skills frontmatter subset. The frontmatter only needs to support string values and basic structures. Write a small dedicated function rather than pulling in a full YAML parser package.

The YAML frontmatter subset supported:
```yaml
name: value
description: a string value
license: MIT
# multiline description with |
description: |
  Line one
  Line two
```

If a future standard adds genuinely complex YAML constructs, add `js-yaml` at that point — not before.

---

## 13. Error Model

Use concise, actionable errors. Each failure must answer: what failed, why it failed, what the user can do next.

### 13.1 Standard Error Messages

```
error: no valid Agent Skill found in source

error: source contains 3 skills; choose one with --skill <name>

  available skills:
    code-review    Review code for correctness and maintainability
    rust           Rust development guidance
    testing        Testing patterns and practices

error: skill 'rust' is already installed at ~/.agents/skills/rust
       to reinstall, remove the directory manually first

error: SKILL.md name 'Rust' is invalid: uppercase letters are not allowed
error: SKILL.md name 'code-review' does not match parent directory 'review'
error: SKILL.md name '' is invalid: name must not be empty
error: SKILL.md description exceeds 1024 characters (got 1280)

error: skill '--bad-name' specified with --skill was not found in source
       available skills: code-review, rust

error: git is required for repository sources but was not found on PATH

error: failed to clone repository: <git stderr output>

error: HTTP 404: https://example.com/SKILL.md

error: source URL returned HTML content; direct SKILL.md URL required

error: ~/.skillx/skill.lock contains invalid JSON: <parse error>
error: ~/.skillx/skill.lock contains duplicate skill names: rust, rust
error: ~/.skillx/skill.lock format version 2 is not supported by this version of skillx

error: unrecognized source format: './local-path'
       supported sources: HTTPS SKILL.md URL, Git repository URL (.git)

error: installation of 'rust' failed: destination already partially exists
       cleaned up. no files were left behind.
```

### 13.2 Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Command error (skill not found, validation failed, already installed, etc.) |
| 2 | Usage error (wrong arguments, unknown command) |

### 13.3 Debug Mode

Set `SKILLX_DEBUG=1` to enable stack traces for unexpected errors. Do not expose debug mode in `--help`. Do not emit any output by default that requires debug mode.

---

## 14. Deterministic Output

No interactive TUI in v1. Plain, stable text output. No ASCII banner. `skillx` should feel like a Unix utility.

### 14.1 `skillx add` Success

```
installed: code-review
path:      ~/.agents/skills/code-review
source:    https://github.com/example/skills.git
```

### 14.2 `skillx list`

```
name           description
───────────────────────────────────────────────────────────
code-review    Review code for correctness and maintainability.
rust           Rust development guidance and idiomatic practices.
```

Columns are left-aligned. Separator uses `─` (U+2500). If the terminal width cannot be determined, use 80 characters. Truncate descriptions with `…` if they exceed available width.

### 14.3 `skillx search <query>`

Same column format as `list` but filtered and scored. Show only entries with score > 0.

### 14.4 No Results

```
no skills found matching 'golang'
run 'skillx add <source>' to install skills
```

### 14.5 `--json` Output

`skillx list --json` emits:
```json
[
  {
    "name": "code-review",
    "description": "...",
    "source": "...",
    "addedAt": "..."
  }
]
```

`skillx search --json <query>` emits the same shape with an additional `"score"` field.

No ANSI styling by default. Easy to pipe, inspect, and test.

---

## 15. Implementation Sequence

Execute in small verified stages. Do not implement the whole feature in one opaque change.

### Phase 1 — Repository Inspection and Bootstrap

Before changing code:
- Inspect repo tree
- Inspect `package.json` (if any)
- Confirm Bun version (`bun --version`)
- Identify current entry point, tests, conventions
- Confirm supported Node/Bun compatibility

**Deliverable:** concrete file paths, `package.json` initialized, TypeScript config in place.

**Verification:**
```bash
bun --version
bun run typecheck  # tsc --noEmit
```

### Phase 2 — CLI Contract

Implement the exact command surface with a dependency-free arg parser.

**Verification:**
```bash
bun run skillx -- --help
bun run skillx -- --version
bun run skillx -- add --help
bun run skillx -- search --help
bun run skillx -- list --help
```

### Phase 3 — SKILL.md Parser and Validator

Implement frontmatter extraction, YAML parsing, name/description validation.

**Unit tests (Bun test runner):**
- Valid minimal skill
- Missing frontmatter opening delimiter
- Missing closing delimiter
- Malformed YAML
- Missing `name`
- Missing `description`
- Empty description (whitespace only)
- `name` > 64 characters
- `name` with uppercase letters
- Leading hyphen
- Trailing hyphen
- Consecutive hyphens
- `name` contains non-ASCII
- Directory/name mismatch
- Valid optional fields (`license`, `compatibility`)
- Unknown frontmatter keys preserved
- Valid body content after frontmatter

```bash
bun test --filter parser
```

### Phase 4 — Discovery Layer

Implement recursive `SKILL.md` discovery.

**Tests:**
- Root-level `SKILL.md`
- Single nested skill
- Multiple nested skills at different depths
- Invalid candidates go to `invalid[]`, not `valid[]`
- `.git` directory is skipped
- Symlinks are skipped (with warning)
- Deterministic ordering (sorted by relative path)
- Source dir is itself a single skill root

```bash
bun test --filter discovery
```

### Phase 5 — Git Resolver

Implement `GitRepoResolver` using `Bun.spawn`.

**Requirements:**
- Shallow clone (`--depth 1`)
- Arguments as array, not shell string
- Useful stderr on failure
- Cleanup on success and failure
- `git` availability check

**Manual verification (not in automated suite):**
```bash
bun run skillx -- add https://github.com/<known-public-skills-repo>.git
```

### Phase 6 — Direct `SKILL.md` HTTP Resolver

Implement `DirectSkillFileResolver` using native `fetch`.

**Requirements:**
- HTTP 2xx check
- Body size limit (`SKILL_MD_MAX_BYTES = 524_288`)
- Content-type must not be `text/html`
- Parsed as `SKILL.md`
- No provider-specific handling

**Tests:** Use local fixture content + mocked fetch. No public internet.

```bash
bun test --filter resolver
```

### Phase 7 — Installer

Implement recursive copy with rollback.

**Tests:**
- Nested files and directories copied
- `scripts/`, `references/`, `assets/` all preserved
- Existing destination rejected with clear message
- Partial-copy rollback on failure
- Symlinks rejected
- Path traversal protection

```bash
bun test --filter installer
```

### Phase 8 — Catalog (`skill.lock`)

Implement JSON catalog read/write.

**Tests:**
- Missing file → empty catalog
- Empty file → error
- Valid one-entry catalog
- Valid multi-entry catalog
- Malformed JSON → error
- Duplicate names → error
- Wrong `format` version → error
- Write and re-read round trip
- Direct URL entry (no `path`)
- Git repository entry (with `path`)
- `addedAt` is valid ISO 8601

```bash
bun test --filter catalog
```

### Phase 9 — Search Scorer

Implement and test deterministic scorer.

**Tests:**
- Exact name wins
- Prefix wins over general substring
- Description match works
- Case insensitive
- Multi-word query
- No results → score 0, excluded
- Stable tie-breaking (consistent sort)
- Empty query → error or all results (document the choice)

```bash
bun test --filter scorer
```

### Phase 10 — Wire `add` Transactionally

Connect:
```
classify source → resolve → discover → validate → select → install → catalog
```

**Guarantees tested:**
- No duplicate installation
- No partial install
- Catalog only changes after install
- Rollback if catalog write fails (install removed)
- Temp source cleanup on every exit path (success, error, exception)

**End-to-end tests using fixture sources + temp home dir:**
- Do not modify the user's real home directory during tests
- Inject `HOME` env variable pointing to a temp dir for all e2e tests

```bash
bun test --filter e2e
```

### Phase 11 — Wire `search` and `list`

Ensure both use the exact same catalog abstraction. No duplicated JSON parsing. No filesystem scans of agent directories.

### Phase 12 — Output Layer

Implement `PlainFormatter` and `JsonFormatter`. Ensure all commands route through `OutputFormatter`. Add `--json` flag tests.

### Phase 13 — Documentation and Final Verification

Update `README.md` to describe:
- What `skillx` is (standards-first, not a package manager)
- Supported commands and flags
- Supported sources
- Installation target
- Meaning of `skill.lock`
- What `skillx` intentionally does not manage
- How to contribute a source resolver (extension point)

Explicitly state that the Agent Skills specification defines the skill format, while `skillx` defines its acquisition and local catalog behavior.

---

## 16. Test Strategy

The default test suite must be **offline and deterministic**.

### 16.1 Unit Tests

Cover (with Bun's built-in test runner):
- Name validation (all error codes)
- Description validation
- Frontmatter extraction
- YAML parsing (all edge cases)
- Catalog parsing/serialization
- Search scoring (all tiers)
- Source classification
- Path safety helpers

### 16.2 Fixture Layout

```
tests/
├── fixtures/
│   ├── single-skill/
│   │   ├── skill-name/
│   │   │   ├── SKILL.md          ← valid skill
│   │   │   ├── scripts/
│   │   │   │   └── example.sh
│   │   │   ├── references/
│   │   │   │   └── REFERENCE.md
│   │   │   └── assets/
│   │   │       └── example.txt
│   ├── multi-skill/
│   │   ├── skills/
│   │   │   ├── rust/
│   │   │   │   └── SKILL.md
│   │   │   └── testing/
│   │   │       └── SKILL.md
│   ├── invalid-skill/
│   │   └── bad-name-SKILL/
│   │       └── SKILL.md          ← name mismatch
│   └── skill-md-files/
│       ├── valid.md
│       ├── no-frontmatter.md
│       ├── missing-name.md
│       ├── name-uppercase.md
│       ├── name-too-long.md
│       ├── empty-description.md
│       └── description-too-long.md
├── unit/
│   ├── parser.test.ts
│   ├── validator.test.ts
│   ├── discovery.test.ts
│   ├── catalog.test.ts
│   ├── scorer.test.ts
│   └── source-classify.test.ts
└── e2e/
    ├── add-single.test.ts
    ├── add-multi.test.ts
    ├── add-http.test.ts
    ├── search.test.ts
    └── list.test.ts
```

### 16.3 End-to-End Scenarios

All e2e tests must use a temporary `HOME` via env injection. At minimum verify:

1. Direct file source installs correctly
2. Single-skill Git repo installs automatically
3. Multi-skill repo with `--skill` installs correctly
4. Multi-skill repo without `--skill` exits with available list
5. Installed files are complete and bit-for-bit unchanged
6. `skill.lock` is created and records all required fields
7. `skillx list` displays catalog entries sorted by name
8. `skillx search` finds by name (exact, prefix, substring)
9. `skillx search` finds by description substring
10. `skillx search --json` emits valid JSON
11. `skillx list --json` emits valid JSON
12. Duplicate install is rejected, no files changed
13. Invalid skill is rejected before installation begins
14. Failed installation leaves no new destination
15. Malformed `skill.lock` is never silently erased
16. Lock write failure triggers install rollback
17. Symlink in skill source is rejected
18. No network request occurs during `search` or `list`

### 16.4 Manual Smoke Tests (Post-Suite)

After the offline suite passes:
```bash
# Real public repo
skillx add https://github.com/<known-skills-repo>.git

# Validate installation against official validator (if available)
skills-ref validate ~/.agents/skills/<skill-name>
```

---

## 17. `package.json` Shape

```json
{
  "name": "skillx",
  "version": "0.1.0",
  "description": "The open standard Agent Skills CLI",
  "bin": {
    "skillx": "./dist/skillx"
  },
  "scripts": {
    "dev": "bun run src/cli.ts",
    "build": "bun build src/cli.ts --compile --outfile dist/skillx",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "test:unit": "bun test tests/unit",
    "test:e2e": "bun test tests/e2e",
    "lint": "tsc --noEmit && echo 'ok'"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/bun": "latest",
    "@types/node": "^22.0.0"
  }
}
```

---

## 18. Cross-Platform Requirements

Target Linux, macOS, and Windows (via `bun build --compile`).

- **Paths:** Use `path.join()` always. Never concatenate `/`. Use `os.homedir()` for `~`.
- **Line endings:** Read files in binary mode; do not normalize line endings in `SKILL.md`.
- **Git:** Use `Bun.spawn` with explicit argument array. Check `git` in PATH.
- **Temp dirs:** Use `fs.mkdtemp` in the system temp dir.
- **Atomic write:** `write to .tmp` → `fs.rename`. Simple cross-platform pattern.
- **Unicode:** Skill names are already constrained to ASCII. Descriptions must round-trip through JSON without corruption (JSON is UTF-8 by definition).

---

## 19. Open Standard Positioning

`skillx` is designed to become the de-facto open standard CLI for the Agent Skills ecosystem. To achieve this:

### 19.1 Zero Lock-In

- Installed skills are plain directories. No `skillx` metadata is added.
- `skill.lock` is plain JSON. Any tool can read it.
- The Agent Skills specification defines the format. `skillx` only defines acquisition.

### 19.2 Documented Extension Points

Document the `SourceResolver` interface publicly. Community contributors can:
- Add a GitHub shorthand resolver
- Add a `.zip` archive resolver
- Add a registry resolver
- Add an npm-package resolver

Without modifying `skillx` core.

### 19.3 Machine-Readable Output

`--json` on every read command enables scripting, IDE integration, and toolchain composition.

### 19.4 Standard Compliance First

`skillx` will reject invalid skills rather than guess their intent. This protects the ecosystem quality.

---

## 20. Architectural Invariants for Code Review

Before declaring the work complete, verify all of these:

- [ ] `skillx` installs valid Agent Skills, not a `skillx`-specific format
- [ ] `SKILL.md` `name` is the skill identity — not URL, not repo name
- [ ] `name` must match the parent directory (hard error)
- [ ] `description` is required and validated against the current standard
- [ ] The installed skill is usable without `skillx`
- [ ] `skillx search` is local-only — zero network calls
- [ ] `skillx list` reads only `skill.lock` — no filesystem scan of agents
- [ ] `~/.skillx/skill.lock` is an acquisition record, not reproducibility state
- [ ] No update/version/dependency mechanism exists
- [ ] No agent autodetection exists
- [ ] No provider-specific source adapters exist (resolvers are transport-based)
- [ ] No skill code is executed during acquisition
- [ ] No existing skill directory is silently overwritten
- [ ] Failed installation does not leave a new partial skill directory
- [ ] Catalog corruption is reported, not silently discarded
- [ ] Zero external runtime dependencies (Bun built-ins only)
- [ ] Automated tests do not require public Internet access
- [ ] Output is deterministic and plain by default
- [ ] `--json` works on `list` and `search`
- [ ] All source classification edge cases are handled (see §4.4)
- [ ] Multi-skill disambiguation is fully handled (see §11.3)
- [ ] Symlinks are rejected during install
- [ ] OCP: new resolvers/formatters require no modification to existing modules

---

## 21. Definition of Done

The implementation is complete only when:

### CLI
```
skillx --help
skillx --version
skillx add <source>
skillx add <source> --skill <name>
skillx search <query>
skillx search --json <query>
skillx list
skillx list --json
```
All behave consistently and have meaningful help text.

### Standard Compliance
A valid standard Agent Skill can be acquired and installed without adding any `skillx` metadata to it. An invalid skill is rejected with a useful, specific error.

### Storage
```
~/.agents/skills/<skill-name>/
~/.skillx/skill.lock
```
Are the only persistent locations created by `skillx` v1.

### Catalog
The catalog records enough information for local rediscovery and human inspection, with no update/dependency/integrity machinery.

### Source Handling
Git repositories and direct `SKILL.md` HTTP(S) URLs work without provider-specific implementations.

### Safety
No shell execution, skill execution, credential scraping, path traversal, silent overwrite, partial install, or symlink follow is present.

### Dependencies
Zero external runtime dependencies. Only dev dependencies in `package.json`.

### Verification
```bash
bun run typecheck
bun test
bun run build
```

Then one manual public-repository smoke test.

---

## 22. Decision Rule

When a design question arises during implementation:

```
Does the Agent Skills standard define it?
        │
       yes ──→ follow the standard
        │
       no
        │
Can it be expressed as a new resolver/formatter (OCP extension)?
        │
       yes ──→ design the interface, document the extension point, defer the impl
        │
       no
        │
Is it required to make skillx's three commands work correctly?
        │
       yes ──→ implement the smallest generic solution
        │
       no
        │
       defer it
```

The product must stay small enough that a new engineer can read the entire codebase and understand it in under an hour.

The goal is not to beat any existing CLI feature-for-feature.

The goal is a **clean, standards-first, boringly reliable, and extensible tool for acquiring and rediscovering Agent Skills** — one that earns the trust of the ecosystem through correctness, not feature count.
