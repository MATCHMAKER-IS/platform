# @platform/crypto

機密データの暗号化(AES-256-GCM)とパスワードハッシュ(scrypt)。`node:crypto` ベース。

```ts
import { deriveKey, encrypt, decrypt, hashPassword, verifyPassword } from "@platform/crypto";
const key = deriveKey(env.ENCRYPTION_SECRET);
const enc = encrypt("1234-5678-9012", key);  // DB 保存用
const dec = decrypt(enc, key);
```

DB に保存する機微項目(マイナンバー・口座番号等)の暗号化に使います。
独自暗号は使わず、確立されたアルゴリズムのみ採用しています。

## パスワードユーティリティ
```ts
import { generatePassword, passwordStrength } from "@platform/crypto";
const pw = generatePassword({ length: 20 });          // 強力な自動生成
const { score, label, suggestions } = passwordStrength(input); // 0〜4 の強度判定
```
