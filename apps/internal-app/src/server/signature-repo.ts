/**
 * 手書きサイン（電子署名画像）。キャンバスで描いた署名を PNG データURL として保存し、対象（承認・書類など）に紐づける。
 * @packageDocumentation
 */

/** サイン。 */
export interface Signature {
  id: string;
  subjectType: string;
  subjectId: string;
  signer: string;
  /** 署名画像（PNG data URL）。 */
  image: string;
  signedAt: string;
}

/** サイン保存の入力。 */
export interface SignatureInput {
  subjectType: string;
  subjectId: string;
  signer: string;
  image: string;
}

const PNG_PREFIX = "data:image/png;base64,";

/** PNG データURL として妥当か（プレフィックスと最小長）。 */
export function isValidSignatureImage(image: string): boolean {
  if (!image.startsWith(PNG_PREFIX)) return false;
  const base64 = image.slice(PNG_PREFIX.length);
  // 極端に短い（実質空）画像は弾く
  return base64.length >= 100 && /^[A-Za-z0-9+/=]+$/.test(base64);
}

/** サインストア。 */
export interface SignatureStore {
  list(subjectType: string, subjectId: string): Promise<Signature[]>;
  get(id: string): Promise<Signature | undefined>;
  save(input: SignatureInput): Promise<Signature>;
}

let memSeq = 0;

/** インメモリ実装。 */
export function createMemorySignatureStore(): SignatureStore {
  const items: Signature[] = [];
  return {
    async list(subjectType, subjectId) {
      return items.filter((s) => s.subjectType === subjectType && s.subjectId === subjectId).sort((a, b) => (a.signedAt < b.signedAt ? 1 : -1)).map((s) => ({ ...s }));
    },
    async get(id) {
      const s = items.find((x) => x.id === id);
      return s ? { ...s } : undefined;
    },
    async save(input) {
      const sig: Signature = { id: `sig${memSeq++}`, subjectType: input.subjectType, subjectId: input.subjectId, signer: input.signer, image: input.image, signedAt: new Date().toISOString() };
      items.push(sig);
      return { ...sig };
    },
  };
}

// ── Prisma 実装 ──

/** SignatureRow の必要部分。 */
export interface SignatureRow {
  id: string;
  subjectType: string;
  subjectId: string;
  signer: string;
  image: string;
  signedAt: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface SignatureStoreDb {
  signatureRow: {
    findMany(args: { where: { subjectType: string; subjectId: string }; orderBy: { signedAt: "desc" } }): Promise<SignatureRow[]>;
    findUnique(args: { where: { id: string } }): Promise<SignatureRow | null>;
    create(args: { data: { subjectType: string; subjectId: string; signer: string; image: string; signedAt: string } }): Promise<SignatureRow>;
  };
}

const rowToSignature = (row: SignatureRow): Signature => ({ id: row.id, subjectType: row.subjectType, subjectId: row.subjectId, signer: row.signer, image: row.image, signedAt: row.signedAt });

/** Prisma 実装。 */
export function createPrismaSignatureStore(db: SignatureStoreDb): SignatureStore {
  return {
    async list(subjectType, subjectId) {
      return (await db.signatureRow.findMany({ where: { subjectType, subjectId }, orderBy: { signedAt: "desc" } })).map(rowToSignature);
    },
    async get(id) {
      const row = await db.signatureRow.findUnique({ where: { id } });
      return row ? rowToSignature(row) : undefined;
    },
    async save(input) {
      const row = await db.signatureRow.create({ data: { subjectType: input.subjectType, subjectId: input.subjectId, signer: input.signer, image: input.image, signedAt: new Date().toISOString() } });
      return rowToSignature(row);
    },
  };
}
