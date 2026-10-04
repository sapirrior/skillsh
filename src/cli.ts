#!/usr/bin/env bun

import { runAdd } from "./commands/add.ts";
import { runSearch } from "./commands/search.ts";
import { runList } from "./commands/list.ts";
import { runRemove } from "./commands/remove.ts";
import { runUpdate } from "./commands/update.ts";
import { PlainFormatter } from "./output/plain.ts";
import { JsonFormatter } from "./output/json.ts";
import { SkillxError } from "./errors.ts";
import { c } from "./output/colors.ts";
import { formatHelp } from "./output/help.ts";
import packageJson from "../package.json";

const VERSION = packageJson.version || "0.1.0";

function getMainHelp(): string {
  return formatHelp({
    title: "skill",
    description: "The Open Standard Agent Skills CLI",
    version: VERSION,
    usage: [
      `skill ${c.cyan("add")} ${c.yellow("<source>")} ${c.dim("[--skill <name>] [--force] [--json]")}`,
      `skill ${c.cyan("remove")} ${c.yellow("<name>")} ${c.dim("[--json]")}`,
      `skill ${c.cyan("update")} ${c.yellow("[name]")} ${c.dim("[--json]")}`,
      `skill ${c.cyan("search")} ${c.yellow("<query>")} ${c.dim("[--json]")}`,
      `skill ${c.cyan("list")} ${c.dim("[--json]")}`,
      `skill ${c.cyan("version")} ${c.dim("[--json]")}`,
    ],
    sections: [
      {
        title: "Commands:",
        items: [
          {
            label: c.cyan(c.bold("add")),
            description: "Acquire and install an Agent Skill from a Git repo or SKILL.md URL",
          },
          {
            label: c.cyan(c.bold("remove")),
            description: "Remove an installed skill and its catalog entry",
          },
          {
            label: c.cyan(c.bold("update")),
            description: "Update an installed skill (or all skills) from original source",
          },
          {
            label: c.cyan(c.bold("search")),
            description: "Search locally installed skills in ~/.skillx/skill.lock",
          },
          {
            label: c.cyan(c.bold("list")),
            description: "List all locally installed skills",
          },
          {
            label: c.cyan(c.bold("version")),
            description: "Show CLI version",
          },
        ],
      },
      {
        title: "Options:",
        items: [
          {
            label: c.dim("-h, --help"),
            description: "Show help message",
          },
          {
            label: c.dim("-v, --version"),
            description: "Show version number",
          },
          {
            label: c.dim("--json"),
            description: "Output machine-readable JSON",
          },
        ],
      },
    ],
    examples: [
      `skill add ${c.yellow("vercel-labs/skills")}`,
      `skill add ${c.yellow("https://github.com/example/skills.git")} --skill ${c.cyan("code-review")}`,
      `skill update ${c.cyan("code-review")}`,
      `skill remove ${c.cyan("code-review")}`,
      `skill search ${c.yellow('"code review"')}`,
      "skill list",
    ],
  });
}

function getRemoveHelp(): string {
  return formatHelp({
    title: "skill remove",
    description: "Remove an installed skill",
    usage: [`skill remove ${c.yellow("<name>")} ${c.dim("[--json]")}`],
    sections: [
      {
        title: "Arguments:",
        items: [
          {
            label: c.yellow("<name>"),
            description: "Name of the installed skill to remove",
          },
        ],
      },
      {
        title: "Options:",
        items: [
          {
            label: c.cyan("--json"),
            description: "Output result as JSON",
          },
          {
            label: c.cyan("-h, --help"),
            description: "Show this help message",
          },
        ],
      },
    ],
  });
}

function getUpdateHelp(): string {
  return formatHelp({
    title: "skill update",
    description: "Update installed skills from their original source",
    usage: [`skill update ${c.yellow("[name]")} ${c.dim("[--json]")}`],
    sections: [
      {
        title: "Arguments:",
        items: [
          {
            label: c.yellow("[name]"),
            description: "Optional skill name to update. Omit to update all installed skills",
          },
        ],
      },
      {
        title: "Options:",
        items: [
          {
            label: c.cyan("--json"),
            description: "Output result as JSON",
          },
          {
            label: c.cyan("-h, --help"),
            description: "Show this help message",
          },
        ],
      },
    ],
  });
}

function getAddHelp(): string {
  return formatHelp({
    title: "skill add",
    description: "Acquire and install an Agent Skill",
    usage: [`skill add ${c.yellow("<source>")} ${c.dim("[--skill <name>] [--force] [--json]")}`],
    sections: [
      {
        title: "Arguments:",
        items: [
          {
            label: c.yellow("<source>"),
            description:
              "GitHub shorthand (owner/repo), Git repository URL (.git), or direct HTTPS SKILL.md URL",
          },
        ],
      },
      {
        title: "Options:",
        items: [
          {
            label: c.cyan("--skill <name>"),
            description: "Disambiguate skill name if repository contains multiple skills",
          },
          {
            label: c.cyan("-f, --force"),
            description: "Overwrite existing skill without prompting for confirmation",
          },
          {
            label: c.cyan("--json"),
            description: "Output result as JSON",
          },
          {
            label: c.cyan("-h, --help"),
            description: "Show this help message",
          },
        ],
      },
    ],
  });
}

function getSearchHelp(): string {
  return formatHelp({
    title: "skill search",
    description: "Search locally installed skills",
    usage: [`skill search ${c.yellow("<query>")} ${c.dim("[--json]")}`],
    sections: [
      {
        title: "Arguments:",
        items: [
          {
            label: c.yellow("<query>"),
            description: "Search term to match against skill name and description",
          },
        ],
      },
      {
        title: "Options:",
        items: [
          {
            label: c.cyan("--json"),
            description: "Output results as JSON",
          },
          {
            label: c.cyan("-h, --help"),
            description: "Show this help message",
          },
        ],
      },
    ],
  });
}

function getListHelp(): string {
  return formatHelp({
    title: "skill list",
    description: "List all locally installed skills",
    usage: [`skill list ${c.dim("[--json]")}`],
    sections: [
      {
        title: "Options:",
        items: [
          {
            label: c.cyan("--json"),
            description: "Output catalog as JSON",
          },
          {
            label: c.cyan("-h, --help"),
            description: "Show this help message",
          },
        ],
      },
    ],
  });
}

export async function main(args: string[] = process.argv.slice(2)): Promise<number> {
  let isJson = false;
  const filteredArgs: string[] = [];

  for (const arg of args) {
    if (arg === "--json") {
      isJson = true;
    } else {
      filteredArgs.push(arg);
    }
  }

  const formatter = isJson ? new JsonFormatter() : new PlainFormatter();

  // Handle help requests
  if (
    filteredArgs.length === 0 ||
    filteredArgs.includes("-h") ||
    filteredArgs.includes("--help") ||
    filteredArgs[0] === "help"
  ) {
    let target = filteredArgs[0] === "help" ? filteredArgs[1] : filteredArgs[0];
    if (target === "-h" || target === "--help" || target === "help") {
      target = filteredArgs[1];
    }

    if (target === "add") {
      console.log(getAddHelp());
      return 0;
    }
    if (target === "remove") {
      console.log(getRemoveHelp());
      return 0;
    }
    if (target === "update") {
      console.log(getUpdateHelp());
      return 0;
    }
    if (target === "search") {
      console.log(getSearchHelp());
      return 0;
    }
    if (target === "list") {
      console.log(getListHelp());
      return 0;
    }
    console.log(getMainHelp());
    return 0;
  }

  if (filteredArgs.includes("-v") || filteredArgs.includes("--version")) {
    console.log(`skill v${VERSION}`);
    return 0;
  }

  const command = filteredArgs[0];

  try {
    switch (command) {
      case "add": {
        let source: string | undefined;
        let skillName: string | undefined;
        let force = false;

        for (let i = 1; i < filteredArgs.length; i++) {
          const arg = filteredArgs[i];
          if (arg === "--skill") {
            i++;
            if (i >= filteredArgs.length) {
              formatter.error("error: missing value for --skill argument");
              return 2;
            }
            skillName = filteredArgs[i];
          } else if (arg.startsWith("--skill=")) {
            skillName = arg.slice("--skill=".length);
          } else if (arg === "--force" || arg === "-f") {
            force = true;
          } else if (arg.startsWith("-")) {
            formatter.error(`error: unknown option '${arg}'`);
            return 2;
          } else {
            if (!source) {
              source = arg;
            } else {
              formatter.error(`error: unexpected argument '${arg}'`);
              return 2;
            }
          }
        }

        if (!source) {
          formatter.error("error: missing required <source> argument for 'add'");
          return 2;
        }

        await runAdd({ source, skill: skillName, force }, formatter);
        return 0;
      }

      case "remove": {
        let skillName: string | undefined;

        for (let i = 1; i < filteredArgs.length; i++) {
          const arg = filteredArgs[i];
          if (arg.startsWith("-")) {
            formatter.error(`error: unknown option '${arg}'`);
            return 2;
          } else {
            if (!skillName) {
              skillName = arg;
            } else {
              formatter.error(`error: unexpected argument '${arg}'`);
              return 2;
            }
          }
        }

        if (!skillName) {
          formatter.error("error: missing required <name> argument for 'remove'");
          return 2;
        }

        await runRemove({ name: skillName }, formatter);
        return 0;
      }

      case "update": {
        let skillName: string | undefined;

        for (let i = 1; i < filteredArgs.length; i++) {
          const arg = filteredArgs[i];
          if (arg.startsWith("-")) {
            formatter.error(`error: unknown option '${arg}'`);
            return 2;
          } else {
            if (!skillName) {
              skillName = arg;
            } else {
              formatter.error(`error: unexpected argument '${arg}'`);
              return 2;
            }
          }
        }

        await runUpdate({ name: skillName }, formatter);
        return 0;
      }

      case "search": {
        const queryParts: string[] = [];

        for (let i = 1; i < filteredArgs.length; i++) {
          const arg = filteredArgs[i];
          if (arg.startsWith("-")) {
            formatter.error(`error: unknown option '${arg}'`);
            return 2;
          }
          queryParts.push(arg);
        }

        const query = queryParts.join(" ");
        if (!query) {
          formatter.error("error: missing required <query> argument for 'search'");
          return 2;
        }

        await runSearch({ query }, formatter);
        return 0;
      }

      case "list": {
        if (filteredArgs.length > 1) {
          formatter.error(`error: unexpected argument '${filteredArgs[1]}'`);
          return 2;
        }

        await runList({}, formatter);
        return 0;
      }

      case "version": {
        if (isJson) {
          console.log(JSON.stringify({ version: VERSION }, null, 2));
        } else {
          console.log(`skill v${VERSION}`);
        }
        return 0;
      }

      default: {
        formatter.error(`error: unknown command '${command}'`);
        return 2;
      }
    }
  } catch (err: any) {
    if (err instanceof SkillxError) {
      formatter.error(`error: ${err.message}`);
      if (process.env.SKILLX_DEBUG === "1") {
        console.error(err.stack);
      }
      return 1;
    }

    formatter.error(`error: unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    if (process.env.SKILLX_DEBUG === "1") {
      console.error(err?.stack);
    }
    return 1;
  }
}

if (import.meta.main) {
  const exitCode = await main();
  process.exit(exitCode);
}
