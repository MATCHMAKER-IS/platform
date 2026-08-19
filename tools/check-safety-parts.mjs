/**
 * **「使わないと危ない部品」が、必要な場所で実際に使われているか**を検査する。
 *   node tools/check-safety-parts.mjs
 *   node tools/check-safety-parts.mjs --list      … 部品ごとの被覆を一覧
 *   node tools/check-safety-parts.mjs --set-floor … 上がったら下限を引き上げる
 *
 * 【なぜ必要か】
 *
 * この基盤は「部品をどう作るか」を丁寧に決めている(ADR 0002 分離 /
 * 0015 分割基準)。しかし **「作った部品をどう繋ぐか」の決定が無かった。**
 * 決定が無いので検査も生まれない。この基盤の骨格は
 * 「決めたことを機械に守らせる」だが、**繋ぎ込みの領域だけ骨格が及んでいなかった。**
 *
 * 部品を作った人は「あること」を知っているので、**繋ぎ忘れに自分では気づけない。**
 * 気づくのは半年後に別の人が同じものを自作しようとしたとき、
 * あるいは**事故が起きたとき**である。
 *
 * 【「存在する」と「繋がっている」は違う】
 *
 * **この検査の要点は分母を持つこと。** 「1 箇所でも使われていれば緑」にすると、
 * 12 本ある API のうち 1 本だけ認可を通している状態が**緑になる**。
 * 実際に 2026-08 の点検では、`withIdempotency` は基盤にあり
 * `purchase-orders` で使われていた——**それでも更新系 154 本中 2 ファイル**だった。
 *
 * だから各部品に「**分母(必要そうな場所)**」と「**分子(実際に使っている場所)**」を
 * 定義し、**比率**で見る。
 *
 * 【上限方式ではなく下限方式】
 *
 * `check-maintainability` と同じ発想を逆向きに使う。いきなり 100% を課すと
 * CI が止まり、止まった CI は無効化されて**何も守らなくなる**。
 * **下がったら止める。上がったら下限を上げる。** これだけで被覆は単調に増える。
 *
 * ただし **`critical: true` の部品は 1 件でも漏れたら落とす**——
 * 繋ぎ忘れがそのまま事故になるものは、ラチェットで待てない。
 *
 * 【登録する基準】
 *
 * 「**繋ぎ忘れると、そのまま事故になるか**」。無害化・認可・鍵の比較・
 * 宛先の検証・重複防止など。**便利なだけの部品は登録しない**——
 * 使う必要のない場面で赤くなると、そのうち誰も見なくなる。
 *
 * **未使用がすべて悪いわけではない。** TOTP / WebAuthn は
 * 「SSO なら IdP に任せる」と決めた結果、使わないのが正解である。
 * 区別すべきは「**使わないと危ないのに未使用**」かどうか。
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FLOOR_FILE = path.join(ROOT, "tools", "safety-parts-floor.json");

/**
 * 「その入力は信頼できる」と宣言する印。理由を必ず添えること。
 *
 *   // safe-source: 基盤の generateQrSvg が組み立てた SVG。利用者入力を含まない
 *
 * **理由の無い印は認めない**(`\S+` を要求している)——
 * 印だけ貼れるようにすると、読まずに貼られる。
 */
const SAFE_MARK = /\/\/\s*safe-source:\s*\S+/;

/**
 * 見張る部品。
 *
 * - `part`      … 部品の名前(表示用)
 * - `uses`      … 「使っている」と判定する正規表現
 * - `needs`     … 「使うべき場所」と判定する正規表現(分母)
 * - `exempt`    … **その部品だけ**を免除する宣言の印。理由つきで書かせる。
 *                 部品ごとに分けるのは、**1 つの印で全部が黙ると危ない**ため
 *                 (レート制限を免除した API が、監査ログまで免除されては困る)
 * - `allow`     … 分母から外す正規表現。**信頼できる生成元**を除外する
 *                 (例: 基盤の `renderErrorPage()` が返す HTML は利用者入力を含まない)
 *
 * 【例外は「宣言」で書く】
 *
 * 正当な理由で部品を通さない場所は、**その行の近くに宣言を書く**。
 * `check-api-auth` の `// public-api:` と同じ作法である。
 *
 * ```tsx
 * // safe-source: 基盤の generateQrSvg が組み立てた SVG。利用者入力を含まない
 * <div dangerouslySetInnerHTML={{ __html: qr }} />
 * ```
 *
 * **ツール側の allow 正規表現を伸ばして黙らせないこと。** あちらは基盤全体に
 * 効いてしまい、**次に本物の穴が空いたときも黙る**。宣言はその場に残るので、
 * **読んだ人がその場で妥当性を判断できる**。
 * - `scope`     … 走査するディレクトリ
 * - `critical`  … true なら被覆 100% を要求(1 件でも漏れたら落ちる)
 * - `why`       … 繋ぎ忘れると何が起きるか。**必ず書くこと**
 */
const WATCHED = [
  {
    part: "sanitizeHtml / escapeHtml",
    uses: /\b(sanitizeHtml|escapeHtml|linkify)\b/,
    needs: /dangerouslySetInnerHTML/,
    // **基盤が組み立てた HTML は対象外。** `renderErrorPage` は
    // `@platform/status-page` が定型文から作るもので、利用者入力を含まない。
    allow: /renderErrorPage|@platform\/status-page/,
    scope: ["apps"],
    critical: true,
    why: "素通しの HTML 挿入は、そのまま XSS になります",
  },
  {
    part: "detectFileType(マジックバイト判定)",
    uses: /\bdetectFileType\b/,
    needs: /\bformData\(\)|\bFile\b.*\barrayBuffer\b/,
    scope: ["apps"],
    critical: true,
    why: "拡張子だけの判定は、中身が別物のファイルを通します",
  },
  {
    part: "isSafeExternalUrl(送信先の検証)",
    // **`isPrivateIp` を探していたのは誤り。** 実際に守りとして使う関数は
    // `isSafeExternalUrl`(`@platform/net`)で、`isPrivateIp` はその部品。
    // 2026-08 の初回計測では `isPrivateIp` を探しており、
    // **showcase の解説ページが 1 件引っかかっただけ**で「1 箇所で使用中」と
    // 出ていた——**実運用では 1 箇所も守られていない**ように見える一方、
    // 実際には webhook-emit が正しく守っていた。**両方向に誤っていた。**
    uses: /\bisSafeExternalUrl\b/,
    // **変数を渡す fetch だけを分母にする。** URL リテラルへの fetch は
    // 送信先が固定なので SSRF にならない。
    needs: /\bfetch\(\s*[a-zA-Z_$][a-zA-Z0-9_$.]*\s*[,)]/,
    // 設定値(環境変数)由来の URL は、管理者が決めるもので利用者は触れない。
    // 免除するなら `// no-ssrf-check: <理由>` をその場に書く。
    exempt: /\/\/\s*no-ssrf-check:\s*\S+/,
    scope: ["apps"],
    critical: true,
    why: "利用者が指定した宛先へ無検証で送ると、社内ネットワークを探られます(SSRF)",
  },
  {
    part: "timingSafeEqualBytes(定数時間比較)",
    uses: /\btimingSafeEqual(Bytes)?\b/,
    // **`=== undefined` / `=== null` は有無の確認**なので分母に入れない。
    // 比べる相手が値のときだけ「鍵の照合」と見なす。
    needs: /\b(secret|token|signature|apiKey)\b\s*===\s*(?!undefined|null)[A-Za-z_$]/i,
    scope: ["apps", "packages"],
    critical: true,
    why: "鍵の照合を `===` で行うと、応答時間から 1 文字ずつ当てられます",
  },
  {
    part: "レート制限（公開 API）",
    // **アプリ側のラッパー名も拾う。** internal-app は `server/rate-limit.ts` に
    // `getLoginLimiter` / `getIpLimiter` などを置いており、基盤の関数名は
    // route には現れない。**基盤の名前だけを探すと、正しく守っている API を
    // 「未接続」と誤検出する**(実際に login が引っかかった)。
    // `limitPublic` … 認可の無い口をまとめて守るアプリ側の入口(internal-app。2026-08)。
    // `guardWrite` … 同じ役目の入口(line-console / crud-template。中で制限器を使う)。
    // **共通の入口を作ったら、ここにも足すこと** ——足さないと、
    // **正しく守っている API を「未接続」と数え、率が実態より低く出る**。
    // 低い率は「直しようがない」と読まれ、**数字そのものが信用されなくなる**。
    uses: /\b(enforceRateLimit|createRateLimiter|checkRateLimit|limitPublic|guardWrite)\b|\b\w*[Ll]imiter\b/,
    // **分母は「認証を通さないと宣言した API」**。`// public-api:` は
    // `check-api-auth` が使っている既存の宣言で、**認証が無いことを認めた印**である。
    // 認証が無いなら、**回数で守るしかない**。
    needs: /\/\/\s*public-api:/,
    scope: ["apps"],
    // 一度に全部へ付けるのは現実的でないため下限ラチェット。
    // ただし**ログイン・問い合わせ・検索の公開 API から先に付けること**。
    // 死活監視は**数十秒ごとに叩かれるのが要件**なので、制限すると監視が落ちる。
    // 免除するなら `// no-rate-limit: <理由>` をその場に書く。
    exempt: /\/\/\s*no-rate-limit:\s*\S+/,
    critical: false,
    why: "認証の無い API を無制限に叩かせると、総当たりと踏み台に使われます",
  },
  {
    part: "秘密を当てさせない口の fail-close",
    // **制限器が落ちたときに通すか止めるか**を宣言しているか。
    //
    // レート制限は既定で「落ちたら通す」(fail-open)——守りのために
    // 業務が止まる方が困るため。**しかし秘密を当てにいける口では逆**で、
    // **制限器を落とすだけで防御を外せる**ことになる。
    // 「一時的に使えない」方が「誰でも突破できる」より軽い。
    // `deny`(通さない)か、**遅延で試行速度を落とす**かのどちらか。
    // ログインは締め出すと**復旧作業のための管理画面にも入れなくなる**ので、
    // 「1 秒待たせてから通す」を選んでいる(`api/auth/login`)——
    // 人には気にならず、総当たりの速度は 1 秒に 1 回まで落ちる。
    uses: /onStoreError:\s*"deny"|setTimeout\(resolve, 1_000\)/,
    // **分母は「認証が無いのに、秘密の一致で通す口」だけ**。
    // 2 つの条件が要る:
    //   1. `// public-api:` … 認証を通さないと宣言している
    //   2. 秘密を照合している(共有鍵・パスワード・初期セットアップ)
    //
    // **認証済みの口を数えない。** そこは認可が守っているので、
    // 制限器が落ちても「誰でも突破できる」状態にはならない——
    // 数えると**直しようのない分母**になり、率が意味を失う
    // (最初にそう作って 14% と出た。2026-08)。
    needs: /\/\/\s*public-api:[\s\S]*?(timingSafeEqual|hashPassword|verifyPassword|canBootstrapAdmin)/,
    scope: ["apps"],
    exempt: /\/\/\s*no-fail-close:\s*\S+/,
    critical: false,
    why: "fail-open のままだと、**制限器を落とすだけで総当たりが通ります**",
  },
  {
    part: "監査ログ（削除操作）",
    // **`auditActions.` の後ろを限定しない。** 2026-08 まで `auditActions.record` だけを
    // 見ており、`auditActions.fileDelete` / `chatDelete` / `boardDelete` のような
    // **用途ごとの入口を数え落として**いた(実態より低く出ていた)。
    // **率が実態より低いと「直しようがない」と読まれ、数字が信用されなくなる。**
    //
    // 呼び出し先で記録している場合(リポジトリ層の `recordAudit`)も拾えないが、
    // それはルートだけを見る限界。**免除には `// no-audit: <理由>` を書くこと。**
    uses: /\b(recordAudit|recordAuditChange|appendEvent)\b|auditActions\.\w+/,
    // **消したという事実が残らないと、後から誰も追えない。**
    // 更新は差分から辿れることがあるが、削除は**行そのものが消える**ので
    // 記録が無ければ「元々無かった」と区別が付かない。
    needs: /export\s+(async\s+function|const)\s+DELETE\b/,
    scope: ["apps"],
    // 一時データ・下書き・キャッシュの削除まで残すと、**本当に見たい行が埋もれる**。
    // 免除するなら `// no-audit: <理由>` をその場に書く。
    exempt: /\/\/\s*no-audit:\s*\S+/,
    critical: false,
    why: "削除の記録が無いと、誰がいつ何を消したか永久に分かりません",
  },
  {
    part: "withIdempotency(二重送信の防御)",
    uses: /\bwithIdempotency\b|idempotencyKey/,
    // **更新系すべてではなく、「二重に走ると実害が出るもの」に絞る。**
    // 検索の POST や既読フラグの更新に冪等は要らない。分母を広く取ると
    // 率が実態より低く出て、**数字が信用されなくなる**(1.3% は「直しようがない」
    // と読まれる)。ここでは送信・金額・承認が絡む更新に限っている。
    //
    // **この語の並びは業務判断で調整すること。** 増やせば分母が増え、
    // 下限ラチェットが自動で追随する。
    needs: /export\s+(async\s+function|const)\s+(POST|PUT|PATCH)\b[\s\S]*?(sendMail|notify|dispatch|invoice|payment|payout|journal|expense|purchase|approve|submit|confirm)/i,
    scope: ["apps"],
    // **ここは critical にしない。** 一度に全部へ付けるのは現実的でなく、
    // 100% を課すと CI が止まり、止まった CI は無効化されて何も守らなくなる。
    // 下限ラチェットで単調に上げる。
    critical: false,
    why: "連打・再送で二重登録が起きます。金額が絡むと実害になります",
  },
];

/** 走査対象のファイルを読み込む。 */
function loadFiles(scope) {
  const files = collectFiles(scope, ROOT, { extensions: [".ts", ".tsx"] });
  return files
    .filter((rel) => !/\.(test|spec)\.tsx?$/.test(rel))
    .filter((rel) => !/\/generated\//.test(rel) && !/\.generated\./.test(rel))
    .map((rel) => ({ rel, text: readFileSync(path.join(ROOT, rel), "utf8") }));
}

/** 部品ごとの被覆を測る。 */
function measure() {
  const cache = new Map();
  const out = [];
  for (const w of WATCHED) {
    const key = w.scope.join(",");
    if (!cache.has(key)) cache.set(key, loadFiles(w.scope));
    const files = cache.get(key);

    const needed = w.needs
      ? files.filter(
          (f) =>
            w.needs.test(f.text) &&
            !(w.allow && w.allow.test(f.text)) &&
            // その場に理由つきの宣言があれば、分母から外す
            !SAFE_MARK.test(f.text) &&
            !(w.exempt && w.exempt.test(f.text)),
        )
      : [];
    const usedAll = files.filter((f) => w.uses.test(f.text));
    // **分母がある場合、分子は「必要な場所のうち使っている場所」。**
    // 全体の使用数を分子にすると、関係ない場所での使用で率が水増しされる。
    const covered = w.needs ? needed.filter((f) => w.uses.test(f.text)) : usedAll;
    const gaps = w.needs ? needed.filter((f) => !w.uses.test(f.text)) : [];

    out.push({
      part: w.part,
      critical: w.critical,
      why: w.why,
      denominator: w.needs ? needed.length : null,
      numerator: covered.length,
      totalUses: usedAll.length,
      percent: w.needs && needed.length > 0 ? Math.floor((covered.length / needed.length) * 1000) / 10 : null,
      gaps: gaps.map((f) => f.rel),
      scanned: files.length,
    });
  }
  return out;
}

export function check({ list = false, setFloor = false } = {}) {
  const results = measure();
  const floor = existsSync(FLOOR_FILE) ? (JSON.parse(readFileSync(FLOOR_FILE, "utf8")).parts ?? {}) : {};

  if (list) {
    for (const r of results) {
      const ratio = r.percent === null ? `${r.totalUses} 箇所` : `${r.numerator}/${r.denominator}（${r.percent}%）`;
      console.log(`${r.critical ? "🔴" : "🟡"} ${r.part}`);
      console.log(`     被覆: ${ratio}  下限: ${floor[r.part] ?? "-"}  走査: ${r.scanned} ファイル`);
      if (r.gaps.length > 0) {
        for (const g of r.gaps.slice(0, 5)) console.log(`     未接続: ${g}`);
        if (r.gaps.length > 5) console.log(`     ほか ${r.gaps.length - 5} 件`);
      }
    }
    return { ok: true };
  }

  if (setFloor) {
    const next = { ...floor };
    for (const r of results) {
      const value = r.percent === null ? r.totalUses : r.percent;
      if (next[r.part] === undefined || value > next[r.part]) next[r.part] = value;
    }
    writeFileSync(
      FLOOR_FILE,
      JSON.stringify(
        {
          _comment:
            "安全に関わる部品の被覆の下限。下がったら CI が落ちる。上がったら --set-floor で引き上げる。critical の部品は下限とは別に 100% を要求する。",
          updatedAt: new Date().toISOString().slice(0, 10),
          parts: next,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`✅ 下限を更新しました(${Object.keys(next).length} 部品)`);
    return { ok: true };
  }

  const failures = [];
  for (const r of results) {
    if (r.critical && r.gaps.length > 0) {
      failures.push(
        `🔴 ${r.part}: 必要な ${r.denominator} 箇所のうち ${r.gaps.length} 箇所が繋がっていません\n` +
          `     ${r.why}\n` +
          r.gaps.slice(0, 5).map((g) => `     → ${g}`).join("\n") +
          "\n     正当な理由があるなら `// safe-source: <理由>` をその場に書いてください" +
          (r.gaps.length > 5 ? `\n     ほか ${r.gaps.length - 5} 件` : ""),
      );
      continue;
    }
    const value = r.percent === null ? r.totalUses : r.percent;
    const min = floor[r.part];
    if (min !== undefined && value < min) {
      failures.push(
        `🟡 ${r.part}: 被覆が ${value} に下がりました(下限 ${min})\n     ${r.why}\n` +
          `     繋ぎ直すか、意図して減らしたなら --set-floor で下限を引き直してください`,
      );
    }
  }

  if (failures.length > 0) {
    console.error(`❌ 安全に関わる部品が繋がっていません(${failures.length} 件):`);
    for (const f of failures) console.error(f);
    console.error("");
    console.error("**基盤に置いただけの部品は、無いのと同じです。**");
    return { ok: false };
  }

  const scanned = results[0]?.scanned ?? 0;
  console.log(
    `✅ 安全に関わる部品はすべて繋がっています(${WATCHED.length} 部品 / ${scanned} ファイルを走査)`,
  );
  return { ok: true };
}

// **`file://${process.argv[1]}` で比べない。** Windows では
// `import.meta.url` が `file:///C:/…`、`process.argv[1]` が `C:\…` になり、
// **一致しないので本体が動かない**(何も出力せず終わる。エラーも出ないので気づけない)。
// 2026-08、`node tools/check-coverage.mjs --set-floor` が Windows で無反応だった。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = check({
    list: process.argv.includes("--list"),
    setFloor: process.argv.includes("--set-floor"),
  });
  process.exit(r.ok ? 0 : 1);
}
