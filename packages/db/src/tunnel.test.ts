import { describe, it, expect } from "vitest";
import { tunnelConfigFromEnv } from "./tunnel";

describe("tunnelConfigFromEnv(環境変数からの設定)", () => {
  it("**BASTION_HOST が無ければ null**（本番は踏み台を経由しない）", () => {
    expect(tunnelConfigFromEnv({ DATABASE_URL: "postgresql://a:b@db.rds.amazonaws.com:5432/app" })).toBeNull();
    expect(tunnelConfigFromEnv({ BASTION_HOST: "", DATABASE_URL: "postgresql://a:b@x:5432/app" })).toBeNull();
  });

  it("**DATABASE_URL から接続先を読み取る**（二重に書かせない）", () => {
    const c = tunnelConfigFromEnv({
      BASTION_HOST: "bastion.example.com",
      DATABASE_URL: "postgresql://a:b@db.xxx.rds.amazonaws.com:5432/app?schema=public",
    });
    expect(c?.dbHost).toBe("db.xxx.rds.amazonaws.com");
    expect(c?.dbPort).toBe(5432);
  });

  it("BASTION_DB_HOST を指定すれば優先する", () => {
    const c = tunnelConfigFromEnv({
      BASTION_HOST: "b.example.com",
      BASTION_DB_HOST: "other.rds.amazonaws.com",
      DATABASE_URL: "postgresql://a:b@db.rds.amazonaws.com:5432/app",
    });
    expect(c?.dbHost).toBe("other.rds.amazonaws.com");
  });

  it("ユーザーの既定は ec2-user（AWS の慣習）", () => {
    const c = tunnelConfigFromEnv({
      BASTION_HOST: "b.example.com",
      BASTION_DB_HOST: "db.example.com",
    });
    expect(c?.bastionUser).toBe("ec2-user");
  });

  it("ユーザー・ポート・鍵を指定できる", () => {
    const c = tunnelConfigFromEnv({
      BASTION_HOST: "b.example.com",
      BASTION_USER: "ubuntu",
      BASTION_PORT: "2222",
      BASTION_IDENTITY_FILE: "~/.ssh/key.pem",
      BASTION_DB_HOST: "db.example.com",
      BASTION_LOCAL_PORT: "15432",
    });
    expect(c?.bastionUser).toBe("ubuntu");
    expect(c?.bastionPort).toBe(2222);
    expect(c?.identityFile).toBe("~/.ssh/key.pem");
    expect(c?.localPort).toBe(15432);
  });

  it("**接続先が分からなければ例外**（黙って localhost につながない）", () => {
    expect(() => tunnelConfigFromEnv({ BASTION_HOST: "b.example.com" })).toThrow();
  });

  it("DATABASE_URL が壊れていても例外で気づける", () => {
    expect(() => tunnelConfigFromEnv({ BASTION_HOST: "b.example.com", DATABASE_URL: "これはURLではない" })).toThrow();
  });

  it("不正な数値は無視する（既定に任せる）", () => {
    const c = tunnelConfigFromEnv({
      BASTION_HOST: "b.example.com",
      BASTION_DB_HOST: "db.example.com",
      BASTION_PORT: "abc",
      BASTION_LOCAL_PORT: "-1",
    });
    expect(c?.bastionPort).toBeUndefined();
    expect(c?.localPort).toBeUndefined();
  });
});

describe("接続文字列の差し替え", () => {
  it("**ホストとポートだけ差し替え、他は保つ**", () => {
    // openTunnel は ssh を起動するためテストしにくいので、
    // connectionUrl と同じロジックを検証する
    const u = new URL("postgresql://appuser:p%40ss@db.xxx.rds.amazonaws.com:5432/app?schema=public&sslmode=require");
    u.hostname = "127.0.0.1";
    u.port = "15432";
    const out = u.toString();

    expect(out).toContain("appuser");
    expect(out).toContain("p%40ss");      // パスワードのエスケープが崩れない
    expect(out).toContain("/app");
    expect(out).toContain("schema=public");
    expect(out).toContain("sslmode=require");
    expect(out).toContain("127.0.0.1:15432");
  });
});
