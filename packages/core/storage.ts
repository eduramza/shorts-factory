import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile, stat, rename, rm } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
export const root = resolve(process.env.CLIPFORGE_ROOT || process.cwd());
export const storageRoot = resolve(root, process.env.STORAGE_DIR || "storage");
export function safePath(key: string) {
  const path = resolve(storageRoot, key);
  if (!path.startsWith(storageRoot + sep) || key.includes("\\"))
    throw new Error("Caminho inválido.");
  return path;
}
export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
export class LocalStorage implements StorageAdapter {
  async put(key: string, data: Buffer) {
    const path = safePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path + ".tmp", data);
    await rename(path + ".tmp", path);
  }
  async get(key: string) {
    return readFile(safePath(key));
  }
  async remove(key: string) {
    await rm(safePath(key), { force: true, recursive: true });
  }
}
export const storage = new LocalStorage();
export async function combineChunks(
  uploadId: string,
  count: number,
  target: string,
) {
  const path = safePath(target);
  await mkdir(dirname(path), { recursive: true });
  const output = createWriteStream(path + ".tmp");
  const generator = async function* () {
    for (let i = 0; i < count; i++) {
      for await (const chunk of createReadStream(
        safePath("uploads/" + uploadId + "/" + i),
      ))
        yield chunk;
    }
  };
  await pipeline(Readable.from(generator()), output);
  await rename(path + ".tmp", path);
  return (await stat(path)).size;
}
