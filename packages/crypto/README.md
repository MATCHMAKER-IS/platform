# @platform/crypto

暗号（パスワードのハッシュ・鍵の導出・署名）。

## これは何のためか

**パスワードを平文で持つと、DB が漏れたときに全員のアカウントが使われます。**

このパッケージは、**戻せない形**で保存し、
**照合だけできる**ようにするためのものです。

## 使う前に知っておくこと

| | |
|---|---|
| **コストを変えると全員ログイン不能** | ハッシュに**コストが含まれています**。旧形式（`salt:hash`）も検証できるようにしてありますが、**変えるときは移行の段取りを組んで**ください |
| **salt は利用者ごとに違うものを** | 同じだと、**1 つ破られたら全部破られます**。**共有の既定 salt は廃止しました**（ADR 0004） |
| **比較は時間を一定に** | 普通の比較だと、**応答時間の差から「何文字目まで合っていたか」が漏れます** |
| **自分で暗号方式を作らない** | 「簡単な暗号でいい」は**必ず破られます** |

## よく使うもの

```ts
import { hashPassword, verifyPassword, deriveKey } from "@platform/crypto";
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
