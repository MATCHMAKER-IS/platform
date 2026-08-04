/**
 * SSH 踏み台（bastion）経由の DB 接続。
 *
 * 本番の DB は**インターネットから直接つながらない**のが普通で、
 * AWS なら RDS をプライベートサブネットに置き、踏み台 EC2 を経由する。
 *
 * ```
 *   手元のPC ──SSH──> 踏み台EC2 ──> RDS(プライベート)
 *   localhost:15432                    db.xxx.rds.amazonaws.com:5432
 * ```
 *
 * `ssh -L 15432:db:5432 ec2-user@bastion` でトンネルを掘り、
 * アプリは `localhost:15432` につなぐ。**アプリ側は普通の接続に見える**。
 *
 * 【なぜ ssh2（npm）を使わないか】
 * OS の `ssh` コマンドを子プロセスで起動する方式にした。理由:
 *
 *   - **鍵の扱いを OS に任せられる**。`~/.ssh/config` の設定・ssh-agent・
 *     多要素認証がそのまま効く。npm の実装だと自前で持つことになる
 *   - **依存が増えない**。`ssh2` は native モジュールを含み、
 *     OS ごとのビルドで問題が起きやすい
 *   - **踏み台の運用は既に ssh でやっている**。同じ設定を二重に持たない
 *
 * 弱点は `ssh` コマンドが要ること（Windows も 10 以降は標準で入っている）。
 *
 * 【使うのは開発時と運用作業のみ】
 * **本番のアプリは踏み台を経由しない**（同じ VPC 内にあるため直接つながる）。
 * この仕組みが要るのは、手元から本番/検証の DB を見るときと、
 * 移行スクリプトを流すとき。
 *
 * @packageDocumentation
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";

/** トンネルの設定。 */
export interface TunnelConfig {
  /** 踏み台のホスト（例 `bastion.example.com` / `10.0.1.5`）。 */
  bastionHost: string;
  /** 踏み台のユーザー（例 `ec2-user`）。 */
  bastionUser: string;
  /** 踏み台の SSH ポート（既定 22）。 */
  bastionPort?: number;
  /**
   * 秘密鍵のパス（例 `~/.ssh/bastion.pem`）。
   *
   * **省略すると ssh-agent や `~/.ssh/config` の設定が使われる**。
   * 鍵をコードで指定するより、`~/.ssh/config` に書く方が安全で管理も楽。
   */
  identityFile?: string;
  /** つなぎ先の DB ホスト（**踏み台から見たホスト名**）。 */
  dbHost: string;
  /** つなぎ先の DB ポート（既定 5432）。 */
  dbPort?: number;
  /**
   * 手元で待ち受けるポート。
   *
   * **省略すると空いているポートを自動で選ぶ**。
   * 固定すると、既に使われていて起動できないことがある。
   */
  localPort?: number;
  /** 接続を確立するまでの待ち時間（ミリ秒。既定 15 秒）。 */
  timeoutMs?: number;
}

/** 開いたトンネル。 */
export interface Tunnel {
  /** 手元で待ち受けているポート。 */
  localPort: number;
  /**
   * このトンネルを通る接続文字列。
   *
   * 元の `DATABASE_URL` のホストとポートだけを差し替えたもの。
   */
  connectionUrl: (originalUrl: string) => string;
  /** トンネルを閉じる（**必ず呼ぶ**。放置すると ssh が残り続ける）。 */
  close: () => Promise<void>;
  /** まだ生きているか。 */
  isAlive: () => boolean;
}

/** 空いているポートを 1 つ取る。 */
async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      server.close(() => (port > 0 ? resolve(port) : reject(new Error("空きポートを取得できませんでした"))));
    });
  });
}

/** ポートにつながるか試す（トンネルが開いたかの判定）。 */
async function canConnect(port: number): Promise<boolean> {
  const { connect } = await import("node:net");
  return new Promise((resolve) => {
    const socket = connect({ port, host: "127.0.0.1" });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(1_000, () => done(false));
  });
}

/**
 * SSH トンネルを開く。
 *
 * **開いたら必ず `close()` を呼ぶ**。呼ばないと ssh の子プロセスが残り、
 * 次に同じポートを使おうとして失敗する。`try/finally` で囲むこと。
 *
 * @param config トンネルの設定
 * @returns 開いたトンネル
 * @throws `ssh` コマンドが無い、または時間内に接続できない場合
 *
 * @example
 * ```ts
 * const tunnel = await openTunnel({
 *   bastionHost: "bastion.example.com",
 *   bastionUser: "ec2-user",
 *   dbHost: "db.xxxxx.ap-northeast-1.rds.amazonaws.com",
 * });
 * try {
 *   const url = tunnel.connectionUrl(process.env.DATABASE_URL!);
 *   const prisma = new PrismaClient({ datasources: { db: { url } } });
 *   // …
 * } finally {
 *   // **必ず閉じる**
 *   await tunnel.close();
 * }
 * ```
 */
export async function openTunnel(config: TunnelConfig): Promise<Tunnel> {
  const localPort = config.localPort ?? (await findFreePort());
  const dbPort = config.dbPort ?? 5432;
  const bastionPort = config.bastionPort ?? 22;
  const timeoutMs = config.timeoutMs ?? 15_000;

  const args = [
    // **トンネルだけ張って、シェルは開かない**（-N）
    "-N",
    // ポート転送: 手元のポート → 踏み台から見た DB
    "-L", `${localPort}:${config.dbHost}:${dbPort}`,
    "-p", String(bastionPort),
    // **接続が切れたら黙って落ちないよう、生存確認を入れる**
    "-o", "ServerAliveInterval=30",
    "-o", "ServerAliveCountMax=3",
    // **初回接続で対話的に聞かれると自動化が止まる**。
    // 踏み台の鍵は事前に known_hosts へ入れておくこと
    "-o", "BatchMode=yes",
    "-o", `ConnectTimeout=${Math.ceil(timeoutMs / 1000)}`,
    ...(config.identityFile !== undefined ? ["-i", config.identityFile] : []),
    `${config.bastionUser}@${config.bastionHost}`,
  ];

  let child: ChildProcess;
  try {
    child = spawn("ssh", args, { stdio: ["ignore", "ignore", "pipe"] });
  } catch (cause) {
    throw new Error(
      "ssh コマンドを起動できませんでした。OpenSSH クライアントが入っているか確認してください",
      { cause },
    );
  }

  // ssh の標準エラーは、失敗したときの原因を知る唯一の手がかり
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
    // 大きくなりすぎないよう、末尾だけ残す
    if (stderr.length > 4_000) stderr = stderr.slice(-4_000);
  });

  let exited = false;
  child.once("exit", () => { exited = true; });

  // ── 接続できるまで待つ ──
  // **ssh は「開いた」と教えてくれない**ので、ポートにつなげるかで判定する
  const deadline = Date.now() + timeoutMs;
  let connected = false;
  while (Date.now() < deadline) {
    if (exited) break;
    if (await canConnect(localPort)) {
      connected = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!connected) {
    child.kill("SIGTERM");
    throw new Error(
      `踏み台へのトンネルを開けませんでした（${config.bastionUser}@${config.bastionHost}:${bastionPort} → ${config.dbHost}:${dbPort}）。`
      + `\n${stderr.trim() || "ssh からの出力はありません。鍵・セキュリティグループ・known_hosts を確認してください"}`,
    );
  }

  return {
    localPort,

    connectionUrl(originalUrl: string): string {
      // **ホストとポートだけを差し替える。** ユーザー・パスワード・
      // データベース名・クエリ（?schema= など）はそのまま保つ
      const u = new URL(originalUrl);
      u.hostname = "127.0.0.1";
      u.port = String(localPort);
      return u.toString();
    },

    async close(): Promise<void> {
      if (exited) return;
      child.kill("SIGTERM");
      // 素直に終わらなければ強制終了する（**残すと次回ポートが塞がる**）
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 3_000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    },

    isAlive: () => !exited,
  };
}

/**
 * トンネルを開いて処理を実行し、必ず閉じる。
 *
 * **`close()` の呼び忘れを防ぐ**。手で `try/finally` を書くより安全。
 *
 * @param config トンネルの設定
 * @param fn トンネル越しの接続文字列を受け取って実行する処理
 * @returns `fn` の戻り値
 * @throws `DATABASE_URL` が無い場合、またはトンネルを開けない場合
 *
 * @example
 * ```ts
 * // 本番の DB を手元から見る（読み取りのみ）
 * const count = await withTunnel(
 *   { bastionHost: "bastion.example.com", bastionUser: "ec2-user", dbHost: "db.xxx.rds.amazonaws.com" },
 *   async (url) => {
 *     const prisma = new PrismaClient({ datasources: { db: { url } } });
 *     try { return await prisma.invoice.count(); }
 *     finally { await prisma.$disconnect(); }
 *   },
 * );
 * ```
 */
export async function withTunnel<T>(
  config: TunnelConfig & { databaseUrl?: string },
  fn: (connectionUrl: string, tunnel: Tunnel) => Promise<T>,
): Promise<T> {
  const original = config.databaseUrl ?? process.env["DATABASE_URL"];
  if (original === undefined || original === "") {
    throw new Error("DATABASE_URL が設定されていません（config.databaseUrl でも渡せます）");
  }

  const tunnel = await openTunnel(config);
  try {
    return await fn(tunnel.connectionUrl(original), tunnel);
  } finally {
    // **必ず閉じる。** 例外が出ても ssh を残さない
    await tunnel.close();
  }
}

/**
 * 環境変数からトンネルの設定を読む。
 *
 * **踏み台の情報をコードに書かない**ための入口。
 * `BASTION_HOST` が設定されていなければ `null` を返すので、
 * 「踏み台があれば使う、無ければ直接つなぐ」という書き方ができる。
 *
 * @param env 環境変数（既定 `process.env`）
 * @returns 設定。**`BASTION_HOST` が無ければ `null`**
 * @throws 踏み台を指定したのに接続先が分からない場合（**黙って localhost につながない**）
 *
 * @example
 * ```ts
 * const config = tunnelConfigFromEnv();
 * const url = config === null
 *   ? env.DATABASE_URL                       // 本番: 同じ VPC 内なので直接
 *   : (await openTunnel(config)).connectionUrl(env.DATABASE_URL);
 * ```
 */
export function tunnelConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): TunnelConfig | null {
  const bastionHost = env["BASTION_HOST"];
  // **踏み台の指定が無ければ null。** 本番では踏み台を経由しない
  if (bastionHost === undefined || bastionHost === "") return null;

  const dbHost = env["BASTION_DB_HOST"] ?? (() => {
    // DATABASE_URL から DB のホストを取り出す（踏み台から見たホスト名）
    const url = env["DATABASE_URL"];
    if (url === undefined) return undefined;
    try { return new URL(url).hostname; } catch { return undefined; }
  })();

  if (dbHost === undefined || dbHost === "") {
    throw new Error(
      "踏み台経由の接続先が分かりません。BASTION_DB_HOST か DATABASE_URL を設定してください",
    );
  }

  const num = (v: string | undefined): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const dbPort = num(env["BASTION_DB_PORT"]) ?? (() => {
    const url = env["DATABASE_URL"];
    if (url === undefined) return undefined;
    try { return num(new URL(url).port); } catch { return undefined; }
  })();

  return {
    bastionHost,
    bastionUser: env["BASTION_USER"] ?? "ec2-user",
    ...(num(env["BASTION_PORT"]) !== undefined ? { bastionPort: num(env["BASTION_PORT"])! } : {}),
    ...(env["BASTION_IDENTITY_FILE"] !== undefined ? { identityFile: env["BASTION_IDENTITY_FILE"] } : {}),
    dbHost,
    ...(dbPort !== undefined ? { dbPort } : {}),
    ...(num(env["BASTION_LOCAL_PORT"]) !== undefined ? { localPort: num(env["BASTION_LOCAL_PORT"])! } : {}),
  };
}
