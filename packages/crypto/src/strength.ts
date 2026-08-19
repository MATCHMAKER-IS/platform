/**
 * **ブラウザ / Edge からも使える部分**だけをまとめた入口。
 *
 * 束ねた入口（`index.ts`）は 鍵導出・ハッシュのために **`node:` を使います**。
 * 画面から入口を取ると**使っていない部分まで載り**、
 * `next build` が `UnhandledSchemeError` で落ちます（2026-08）。
 *
 * ここにあるのは**依存を持たない処理だけ**なので、どこからでも呼べます。
 * `ratelimit` / `cron` / `net` の `./browser` と同じ形です。
 *
 * @packageDocumentation
 */
/**
 * パスワードの強度を推定する(0〜4)。ヒューリスティックで依存ライブラリ不要。
 * 強度メーター表示や、登録時のフィードバックに使う。
 *
 * @param password 評価するパスワード
 * @returns スコア・ラベル・改善ヒント
 *
 * @example
 * ```ts
 * const { score, label, suggestions } = passwordStrength(input);
 * ```
 */
export function passwordStrength(password: string): PasswordStrength {
  const suggestions: string[] = [];
  let score = 0;
  const len = password.length;
  const lower = /[a-z]/.test(password);
  const upper = /[A-Z]/.test(password);
  const digit = /[0-9]/.test(password);
  const symbol = /[^A-Za-z0-9]/.test(password);
  const classes = [lower, upper, digit, symbol].filter(Boolean).length;

  if (len >= 12) score += 2;
  else if (len >= 8) score += 1;
  else suggestions.push("8文字以上にしてください");

  if (classes >= 3) score += 2;
  else if (classes >= 2) score += 1;
  if (!upper) suggestions.push("英大文字を含めると強くなります");
  if (!digit) suggestions.push("数字を含めると強くなります");
  if (!symbol) suggestions.push("記号を含めると強くなります");

  if (/(.)\1{2,}/.test(password)) {
    score -= 1;
    suggestions.push("同じ文字の連続は避けてください");
  }
  if (isSequential(password)) {
    score -= 1;
    suggestions.push("連続した文字列は避けてください");
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    score = 0;
    suggestions.push("よくあるパスワードは避けてください");
  }

  const clamped = Math.max(0, Math.min(4, score)) as 0 | 1 | 2 | 3 | 4;
  return { score: clamped, label: STRENGTH_LABELS[clamped], suggestions };
}
