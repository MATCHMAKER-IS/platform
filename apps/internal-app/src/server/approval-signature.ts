/**
 * 承認フローと手書きサインの連携。承認（伝票・稟議）に必要な署名が揃っているかを判定する。純粋関数のみ。
 * 署名は signature-repo に subjectType="approval"・subjectId=承認キー で保存される想定。
 * @packageDocumentation
 */
import { type Signature } from "./signature-repo";

/** 承認の署名対象キー（docType:docNumber）。 */
export function approvalSubjectId(docType: string, docNumber: string): string {
  return `${docType}:${docNumber}`;
}

/** 署名状況。 */
export interface ApprovalSignatureStatus {
  required: boolean;
  signed: boolean;
  signers: string[];
}

/** 必要署名が揃っているか（required=true なら 1 名以上の署名で satisfied）。 */
export function approvalSignatureStatus(required: boolean, signatures: Signature[]): ApprovalSignatureStatus {
  const signers = signatures.map((s) => s.signer);
  return { required, signed: signatures.length > 0, signers };
}

/** 承認を確定してよいか（署名不要、または署名済みなら true）。 */
export function canFinalizeApproval(required: boolean, signatures: Signature[]): boolean {
  return !required || signatures.length > 0;
}

/** 金額としきい値から署名が必須かを判定する（threshold が正で amount>=threshold なら必須）。 */
export function signatureRequiredByAmount(amount: number, threshold: number): boolean {
  return threshold > 0 && amount >= threshold;
}
