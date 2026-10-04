import { readdir, mkdir, rm, lstat } from "fs/promises";
import { join, resolve, relative } from "path";
import { homedir } from "os";
import { InstallError } from "./errors.ts";

export function getSkillsInstallDir(customHome?: string): string {
  const home = customHome || process.env.HOME || homedir();
  return join(home, ".agents", "skills");
}

export function getSkillDestination(skillName: string, customHome?: string): string {
  return join(getSkillsInstallDir(customHome), skillName);
}

export async function isSkillInstalled(
  skillName: string,
  customHome?: string
): Promise<boolean> {
  const destDir = getSkillDestination(skillName, customHome);
  try {
    const st = await lstat(destDir);
    return !!st;
  } catch {
    return false;
  }
}

/**
 * Recursively copies a skill directory safely and atomically with rollback.
 */
export async function installSkill(
  srcDir: string,
  skillName: string,
  customHome?: string,
  overwrite = false
): Promise<string> {
  const destDir = getSkillDestination(skillName, customHome);

  // Check if destination exists
  const exists = await isSkillInstalled(skillName, customHome);
  if (exists && !overwrite) {
    const home = customHome || process.env.HOME || homedir();
    const displayPath = destDir.startsWith(home)
      ? `~${destDir.slice(home.length)}`
      : destDir;
    throw new InstallError(
      "ALREADY_INSTALLED",
      `skill '${skillName}' is already installed at ${displayPath}`
    );
  }

  const tempDestDir = `${destDir}.installing.${Date.now()}`;
  try {
    await mkdir(tempDestDir, { recursive: true });
    await copyRecursive(srcDir, tempDestDir, srcDir, tempDestDir);

    if (exists) {
      await rm(destDir, { recursive: true, force: true }).catch(() => {});
    }
    await Bun.spawn(["mv", tempDestDir, destDir]).exited;
    return destDir;
  } catch (err) {
    await rm(tempDestDir, { recursive: true, force: true }).catch(() => {});
    if (err instanceof InstallError) {
      throw err;
    }
    throw new InstallError(
      "COPY_FAILED",
      `failed to install skill '${skillName}': ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function copyRecursive(
  currentSrc: string,
  currentDest: string,
  rootSrc: string,
  rootDest: string
): Promise<void> {
  const entries = await readdir(currentSrc, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(currentSrc, entry.name);
    const destPath = join(currentDest, entry.name);

    // Path escape check
    const resolvedDest = resolve(destPath);
    if (!resolvedDest.startsWith(resolve(rootDest))) {
      throw new InstallError(
        "PATH_ESCAPE",
        `Attempted path escape during installation: ${destPath}`
      );
    }

    if (entry.isSymbolicLink()) {
      const relPath = relative(rootSrc, srcPath);
      throw new InstallError(
        "SYMLINK_REJECTED",
        `symlinks are not permitted in skill packages: ${relPath}`
      );
    }

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyRecursive(srcPath, destPath, rootSrc, rootDest);
    } else if (entry.isFile()) {
      const file = Bun.file(srcPath);
      await Bun.write(destPath, file);
    }
  }
}

export async function rollbackInstallation(destDir: string): Promise<void> {
  try {
    await rm(destDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export async function removeInstalledSkill(
  skillName: string,
  customHome?: string
): Promise<string> {
  const destDir = getSkillDestination(skillName, customHome);
  try {
    await rm(destDir, { recursive: true, force: true });
  } catch (err) {
    throw new InstallError(
      "REMOVE_FAILED",
      `Failed to remove skill directory at ${destDir}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  return destDir;
}

export async function updateInstalledSkill(
  srcDir: string,
  skillName: string,
  customHome?: string
): Promise<string> {
  const destDir = getSkillDestination(skillName, customHome);
  const tempDestDir = `${destDir}.updating.${Date.now()}`;

  try {
    await mkdir(tempDestDir, { recursive: true });
    await copyRecursive(srcDir, tempDestDir, srcDir, tempDestDir);

    // Remove old destination and replace with new
    await rm(destDir, { recursive: true, force: true }).catch(() => {});
    await Bun.spawn(["mv", tempDestDir, destDir]).exited;
    return destDir;
  } catch (err) {
    await rm(tempDestDir, { recursive: true, force: true }).catch(() => {});
    throw new InstallError(
      "UPDATE_FAILED",
      `Failed to update skill '${skillName}': ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
