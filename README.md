# skillx

The open-standard, protocol-first CLI for acquiring, validating, and locally discovering **Agent Skills**.

`skillx` is designed to be the de-facto standard tool for the Agent Skills ecosystem — in the same way `curl` is the de-facto standard for HTTP. It is fast, lightweight, strictly standards-compliant, and runs with zero external runtime dependencies.

---

## Features

- **Standard-First**: Validates Agent Skills against the official specification (`SKILL.md` frontmatter, naming, descriptions).
- **Universal Target**: Installs cleanly into `~/.agents/skills/<skill-name>/` — compatible with any agent (OpenCode, Claude Code, Cursor, Codex, Antigravity, Amp, etc.) without vendor lock-in.
- **Zero Runtime Dependencies**: Powered entirely by Bun native primitives (`fetch`, `Bun.spawn`, `fs`, `path`).
- **Flexible Sources**: Direct support for GitHub shorthand (`owner/repo`), Git repositories (`.git`), and direct HTTPS `SKILL.md` URLs.
- **Local-Only Catalog**: Fast local rediscovery in `~/.skillx/skill.lock` with deterministic search scoring and zero remote telemetry.
- **Responsive Terminal UI**: Word-wrapping and layouts automatically adapt to your terminal size (desktop terminals, split panes, and mobile Termux).
- **Machine-Readable**: Full `--json` support across all commands for scripting and agent toolchains.

---

## Quickstart

### Installation

Compile and install the single standalone binary:

```bash
# Clone the repository
git clone https://github.com/sapirrior/skillx.git
cd skillx

# Build compiled binary
bun run build

# (Optional) Move to your PATH
mv dist/skillx ~/.local/bin/
```

Or run directly using Bun:

```bash
bun run src/cli.ts <command>
```

---

## Usage

### 1. Add a Skill

Acquire and install an Agent Skill from GitHub shorthand, a Git repository, or a direct `SKILL.md` URL:

```bash
# GitHub shorthand (owner/repo)
skillx add vercel-labs/skills

# Specific skill from a multi-skill repository
skillx add vercel-labs/skills --skill pr-labeling

# Git repository URL
skillx add https://github.com/example/skills.git

# Direct HTTPS SKILL.md URL
skillx add https://raw.githubusercontent.com/example/skills/main/code-review/SKILL.md

# Overwrite existing skill without interactive prompt
skillx add vercel-labs/skills --skill pr-labeling --force
```

### 2. List Installed Skills

Display all locally installed skills recorded in the local catalog:

```bash
skillx list
```

Emit machine-readable JSON:

```bash
skillx list --json
```

### 3. Search Local Skills

Perform fast, deterministic local search against skill names and descriptions:

```bash
skillx search "code review"
skillx search rust --json
```

### 4. Update Skills

Re-acquire and update skills from their original acquisition source:

```bash
# Update a specific skill
skillx update pr-labeling

# Update all installed skills
skillx update
```

### 5. Remove a Skill

Uninstall a skill and remove its entry from the local catalog:

```bash
skillx remove pr-labeling
```

---

## Command Reference

| Command | Description |
|---|---|
| `skillx add <source>` | Acquire and install an Agent Skill (`--skill`, `--force`, `--json`) |
| `skillx remove <name>` | Remove an installed skill and its catalog entry (`--json`) |
| `skillx update [name]` | Update an installed skill or all skills from original source (`--json`) |
| `skillx search <query>` | Search locally installed skills with deterministic ranking (`--json`) |
| `skillx list` | List all locally installed skills (`--json`) |
| `skillx version` | Show CLI version (`--json`) |
| `skillx help [command]` | Display detailed help menu |

---

## How It Works

### File System Layout

`skillx` only creates and manages two locations:

1. **`~/.agents/skills/<skill-name>/`**:  
   The complete, unmodified skill package (including `SKILL.md`, `scripts/`, `references/`, `assets/`). An agent never needs `skillx` to execute installed skills.
2. **`~/.skillx/skill.lock`**:  
   A clean JSON catalog recording the local installation metadata:
   ```json
   {
     "format": 1,
     "skills": [
       {
         "name": "pr-labeling",
         "description": "Classify a skills CLI pull request from its description and patch, while respecting existing labels.",
         "source": "vercel-labs/skills",
         "path": ".factory/workflows/pr-labeling/skills/pr-labeling",
         "addedAt": "2026-10-04T15:10:42.089Z"
       }
     ]
   }
   ```

### Safety & Invariants

- **Atomic Transactions**: Installation copies to a temporary directory first and atomically replaces the target only on success.
- **Rollback on Error**: If any step fails during install or catalog persistence, newly created directories are cleaned up immediately.
- **No Path Traversal**: Symlinks escaping skill roots and relative directory traversal attacks are rejected.
- **No Execution**: Installing a skill never executes shell scripts, Python, or binaries.

---

## Development & Testing

Run the full offline test suite:

```bash
# Run all tests
bun test

# Typecheck
bun run typecheck

# Compile binary
bun run build
```

---

## License

MIT © 2026
