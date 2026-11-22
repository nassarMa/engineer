import { gunzipSync } from "node:zlib";

/** Files of a .tar.gz archive, keyed by path with the archive's top folder removed. */
export function readTarGz(archive: Uint8Array, stripTop = true): Map<string, string> {
  const tar = gunzipSync(archive);
  const files = new Map<string, string>();
  const decoder = new TextDecoder();
  let offset = 0;
  let longName: string | null = null;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break; // end-of-archive blocks
    const field = (start: number, length: number) => decoder.decode(header.subarray(start, start + length)).replace(/\0.*$/s, "");
    const size = parseInt(field(124, 12).trim() || "0", 8);
    const type = field(156, 1);
    const prefix = field(345, 155);
    let name = longName ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100));
    longName = null;
    const body = tar.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;

    if (type === "L") {
      // GNU long name: the next entry's real path is in this body.
      longName = decoder.decode(body).replace(/\0.*$/s, "");
      continue;
    }
    if (type !== "0" && type !== "") continue; // directories, links, pax headers
    if (stripTop) name = name.split("/").slice(1).join("/");
    if (!name) continue;
    files.set(name, decoder.decode(body));
  }
  return files;
}
