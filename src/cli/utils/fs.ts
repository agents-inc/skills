import fs from 'fs-extra';
import fg from 'fast-glob';
import path from 'path';

export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

export async function readFileOptional(filePath: string, fallback = ''): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return fallback;
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  return fs.pathExists(filePath);
}

export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function listDirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return [];
  }
}

export async function glob(pattern: string, cwd: string): Promise<string[]> {
  return fg(pattern, { cwd, onlyFiles: true });
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

export async function remove(filePath: string): Promise<void> {
  await fs.remove(filePath);
}

export async function copy(src: string, dest: string): Promise<void> {
  await fs.copy(src, dest);
}

export { fs };
