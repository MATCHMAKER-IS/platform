/**
 * マジックバイト(先頭バイト列)によるファイル種別判定(純)。
 * 拡張子は偽装できるため、アップロード検証は中身で見るのが安全。
 * @packageDocumentation
 */

/** 判定結果。 */
export interface FileTypeInfo { ext: string; mime: string }

interface Signature { ext: string; mime: string; offset: number; bytes: number[]; /** マスク(0=任意)。省略可。 */ mask?: number[] }

// 代表的なフォーマットのシグネチャ。
const SIGNATURES: Signature[] = [
  { ext: "png", mime: "image/png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: "jpg", mime: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { ext: "gif", mime: "image/gif", offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  { ext: "bmp", mime: "image/bmp", offset: 0, bytes: [0x42, 0x4d] },
  { ext: "webp", mime: "image/webp", offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // "WEBP" at 8 (RIFF....WEBP)
  { ext: "pdf", mime: "application/pdf", offset: 0, bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { ext: "zip", mime: "application/zip", offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  { ext: "gz", mime: "application/gzip", offset: 0, bytes: [0x1f, 0x8b] },
  { ext: "7z", mime: "application/x-7z-compressed", offset: 0, bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { ext: "rar", mime: "application/vnd.rar", offset: 0, bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] },
  { ext: "mp3", mime: "audio/mpeg", offset: 0, bytes: [0x49, 0x44, 0x33] }, // ID3
  { ext: "wav", mime: "audio/wav", offset: 8, bytes: [0x57, 0x41, 0x56, 0x45] }, // WAVE
  { ext: "ogg", mime: "audio/ogg", offset: 0, bytes: [0x4f, 0x67, 0x67, 0x53] },
  { ext: "mp4", mime: "video/mp4", offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ftyp
];

function matches(buf: Uint8Array, sig: Signature): boolean {
  if (buf.length < sig.offset + sig.bytes.length) return false;
  for (let i = 0; i < sig.bytes.length; i++) {
    const b = buf[sig.offset + i] as number;
    const m = sig.mask?.[i] ?? 0xff;
    if ((b & m) !== ((sig.bytes[i] as number) & m)) return false;
  }
  return true;
}

/** 先頭バイト列からファイル種別を判定する。不明なら null。 */
export function detectFileType(buffer: Uint8Array): FileTypeInfo | null {
  for (const sig of SIGNATURES) {
    if (matches(buffer, sig)) return { ext: sig.ext, mime: sig.mime };
  }
  return null;
}

/** 判定結果が許可リストの拡張子に含まれるか(アップロード検証用)。 */
export function isAllowedFileType(buffer: Uint8Array, allowedExts: readonly string[]): boolean {
  const detected = detectFileType(buffer);
  return detected !== null && allowedExts.map((e) => e.toLowerCase().replace(/^\./, "")).includes(detected.ext);
}

/** 中身から判定した拡張子と、ファイル名の拡張子が一致するか(偽装検出)。 */
export function extensionMatchesContent(filename: string, buffer: Uint8Array): boolean {
  const detected = detectFileType(buffer);
  if (!detected) return false;
  const nameExt = (filename.split(".").pop() ?? "").toLowerCase();
  const alias: Record<string, string> = { jpeg: "jpg" };
  const normalized = alias[nameExt] ?? nameExt;
  return normalized === detected.ext;
}
