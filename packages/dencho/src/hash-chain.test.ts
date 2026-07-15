import { describe, it, expect } from "vitest";
import { appendEvidence, verifyEvidenceChain, hashEvidence, canonicalJson, GENESIS_HASH } from "./hash-chain.js";
describe("dencho hash chain (tamper evidence)", () => {
  const build = () => {
    let chain: ReturnType<typeof appendEvidence>[] = [];
    chain = [appendEvidence(chain, { inv: "1", amount: 11000 }, "2025-07-25T10:00:00Z")];
    chain = [...chain, appendEvidence(chain, { inv: "2", amount: 22000 }, "2025-07-26T10:00:00Z")];
    chain = [...chain, appendEvidence(chain, { inv: "3", amount: 33000 }, "2025-07-27T10:00:00Z")];
    return chain;
  };
  it("chains and verifies", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
    const chain = build();
    expect(chain[0]!.prevHash).toBe(GENESIS_HASH);
    expect(chain[1]!.prevHash).toBe(chain[0]!.hash);
    expect(verifyEvidenceChain(chain).valid).toBe(true);
  });
  it("detects tampering", () => {
    const chain = build();
    const tampered = structuredClone(chain);
    (tampered[1]!.data as { amount: number }).amount = 99999;
    const v = verifyEvidenceChain(tampered);
    expect(v.valid).toBe(false);
    expect(v.brokenAt).toBe(1);
    // re-hashing the altered record still breaks the following link
    const swapped = structuredClone(chain);
    (swapped[1]!.data as { amount: number }).amount = 99999;
    swapped[1]!.hash = hashEvidence(swapped[1]!.seq, swapped[1]!.recordedAt, swapped[1]!.data, swapped[1]!.prevHash);
    expect(verifyEvidenceChain(swapped).brokenAt).toBe(2);
  });
});
