/**
 * bnd4.ts — Elden Ring regulation.bin parser. regulation.bin is a `BND4` archive
 * (a FromSoftware container format) — its DCX-compressed inner files are the
 * `*.param` files we need (EquipParamWeapon, etc.).
 *
 * Reverse-engineered via SoulsFormats / Smithbox. We avoid C# interop and
 * parse it in pure TypeScript. Only the read paths needed by the calculator
 * are implemented.
 */

export interface BndEntry {
  /** Arrow index inside the archive. */
  id: number;
  /** Slash-normalised name stored in the header. */
  name: string;
  /** Raw uncompressed file bytes. */
  data: Uint8Array;
}

/** Read a big-endian uint32. */
function u32be(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] << 24) |
    (buf[offset + 1] << 16) |
    (buf[offset + 2] << 8) |
    buf[offset + 3]
  ) >>> 0;
}

/** Read a big-endian uint16. */
function u16be(buf: Uint8Array, offset: number): number {
  return ((buf[offset] << 8) | buf[offset + 1]) >>> 0;
}

/** Read a little-endian uint32 (used in the actual row offsets). */
function u32le(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset + 3] << 24) |
    (buf[offset + 2] << 16) |
    (buf[offset + 1] << 8) |
    buf[offset]
  ) >>> 0;
}

/** Read an array of chars for a "magic" header. */
function readAscii(buf: Uint8Array, offset: number, length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) s += String.fromCharCode(buf[offset + i]);
  return s;
}

/**
 * Read a BND4 archive. regulation.bin starts with a `BND4` magic header.
 * We implement the format described in SoulsFormats `BND4archive.cs`.
 *
 * Layout (big-endian):
 *   0x00: "BND4"
 *   0x04: format version (unused)
 *   0x08: bit-flags
 *   0x0C: file count
 *   0x10: header length
 *   per file: id (uint32) + size (uint32) + offset (uint32) + nameOffset (uint32)
 */
export function readBnd4(data: Uint8Array): BndEntry[] {
  const magic = readAscii(data, 0, 4);
  if (magic !== "BND4") {
    throw new Error(`Not a BND4 archive: magic=${JSON.stringify(magic)}`);
  }

  // Flags at 0x08: byte 1 bit 0x80 = filename table, etc.
  const fileCount = u32be(data, 0x0c);
  const recordsOffset = u32be(data, 0x10);
  const filenamesBit = (data[0x08] & 0x40) !== 0;

  // Filenames table offset is stored at 0x1C when filenamesBit, else zero.
  const filenamesTableOffset = filenamesBit ? u32be(data, 0x1c) : 0;

  const entries: BndEntry[] = [];
  for (let i = 0; i < fileCount; i++) {
    const recordOffset = recordsOffset + i * 0x10;
    const id = u32be(data, recordOffset + 0x00);
    const size = u32be(data, recordOffset + 0x04);
    const dataOffset = u32be(data, recordOffset + 0x08);
    const nameOffsetOffset = u32be(data, recordOffset + 0x0c);

    let name = "";
    if (filenamesBit && filenamesTableOffset > 0) {
      // nameOffsetOffset is an absolute byte offset into the archive where a
      // null-terminated UTF-8 string resides.
      name = readCString(data, nameOffsetOffset);
    }

    entries.push({
      id,
      name,
      data: data.subarray(dataOffset, dataOffset + size),
    });
  }

  return entries;
}

function readCString(data: Uint8Array, offset: number): string {
  let end = offset;
  while (end < data.length && data[end] !== 0) end++;
  return new TextDecoder("utf-8").decode(data.subarray(offset, end));
}

/**
 * Read a DCX file. Elden Ring regulation.bin's inner param files are usually
 * not DCX-compressed, bute the standard container can be. This supports the
 * `DCP` flavor `DCP_ZSTD` (zstd) and `DCP_EDGE` (DEFLATE) used by FromSoft.
 *
 * For full DCX support we use the `zlib` module for DCP_EDGE; zstd requires
 * `@one comic/zstd` which the server can opt-in to. For our regulation parser
 * we usually receive already-decompressed params.
 */
export function maybeDecompress(data: Uint8Array): Uint8Array {
  const magic = readAscii(data, 0, 3);
  if (magic !== "DCX") return data;
  // Read the compression method at offset 0x08.
  const method = readAscii(data, 0x08, 4);
  if (method === "EDGE") {
    return inflateDcxEdge(data);
  }
  // Unsupported compression: callers should decompress externally.
  throw new Error(`Unsupported DCX method: ${JSON.stringify(method)}`);
}

function inflateDcxEdge(data: Uint8Array): Uint8Array {
  // Header is 0x1C bytes, then a zlib stream to the end - 0x08.
  const zlib = require("node:zlib");
  const start = 0x1c;
  const end = data.length - 8;
  const buf = Buffer.from(data.subarray(start, end));
  return new Uint8Array(zlib.inflateSync(buf));
}

/**
 * Read a `PARAM` file. Regulation params use the `PARAMBF` (multi-row) format
 * with `PARAM` parameter data section. Each row stores fields at fixed offsets
 * that vary per param type. This function returns the raw rows keyed by row
 * ID; the caller interprets fields based on the param schema.
 */
export interface ParamRow {
  id: number;
  /** Raw row bytes; interpretation depends on the param type. */
  data: Uint8Array;
}

export interface ParamData {
  /** Identifier of the row schema. */
  paramType: string;
  rows: ParamRow[];
}

export function readParam(data: Uint8Array): ParamData {
  // Elden Ring params are stored as PARAMBND; individual entries are PARAM
  // files. They start with either "PARAM" or "PARAMBF" magic.

  // Quick sniff.
  const magic = readAscii(data, 0, 4);
  if (magic !== "PARA" && readAscii(data, 0, 6) !== "PARAMB") {
    throw new Error(`Not a PARAM file: magic=${JSON.stringify(readAscii(data, 0, 8))}`);
  }

  let cursor = 0;
  if (readAscii(data, 0, 6) === "PARAMB") {
    // "PARAMBF" prefix wraps the header: skip the next ~0x20 marker.
    cursor = 0x20;
  }

  // Top-level PARAM header (little-endian per Elden Ring convention).
  const paramMagic = readAscii(data, cursor, 4);
  if (paramMagic !== "PARA" && paramMagic !== "PA") {
    throw new Error(`Unexpected PARAM header: ${JSON.stringify(paramMagic)}`);
  }

  // Field offsets (according to SoulsFormats PARAMPARAMHeader):
  //   +0x00 "PAR" 4-char magic? actually string is "PARAM"
  //   +0x0C: format version? still 8 byte header.
  const rowCount = u32le(data, cursor + 0x0c);
  const rowSize = u32le(data, cursor + 0x14);
  const rowOffset = u32le(data, cursor + 0x18);

  const rows: ParamRow[] = [];
  for (let i = 0; i < rowCount; i++) {
    const record = rowOffset + i * 0x08;
    const id = u32le(data, record);
    const rowDataOffset = u32le(data, record + 4);
    rows.push({
      id,
      data: data.subarray(rowDataOffset, rowDataOffset + rowSize),
    });
  }

  return { paramType: paramMagic, rows };
}
