"use client";
/**
 * ファイル種別の判定デモ。**`@platform/fs` の `detectFileType` をそのまま動かす**。
 *
 * 拡張子や `Content-Type` は**送る側が自由に名乗れる**ので、信用できない。
 * `evil.exe` を `photo.png` に改名しただけのファイルを受け入れると、
 * サーバに実行ファイルが置かれることになる。
 *
 * この関数は**先頭のバイト列(マジックナンバー)**を見るので、改名では騙せない。
 * 純ロジックなのでブラウザでも動く(ファイルの中身はサーバに送らない)。
 */
import * as React from "react";
import { Badge, Alert, FileInput } from "@platform/ui";
// **バレル(@platform/fs)は node:fs を引き込む**ので、ブラウザからはサブパスで取る
import { detectFileType, extensionMatchesContent, isAllowedFileType } from "@platform/fs/magic";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };

/** アップロードで許す種別(例)。 */
const ALLOWED = ["png", "jpg", "gif", "webp", "pdf"];

interface Result {
  name: string;
  sizeBytes: number;
  /** 名乗っている MIME(ブラウザが拡張子から推測したもの)。 */
  claimedType: string;
  /** 中身から判定した種別。**判定できなければ null**。 */
  detected: { ext: string; mime: string } | null;
  /** 拡張子と中身が一致するか。 */
  matches: boolean;
  /** 許可リストに含まれるか。 */
  allowed: boolean;
}

export function FileTypeDemo() {
  const [result, setResult] = React.useState<Result | null>(null);

  const onPick = async (file: File) => {
    // **先頭の数十バイトで足りる**(全部読む必要はない)
    const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    setResult({
      name: file.name,
      sizeBytes: file.size,
      claimedType: file.type || "(不明)",
      detected: detectFileType(head),
      matches: extensionMatchesContent(file.name, head),
      allowed: isAllowedFileType(head, ALLOWED),
    });
  };

  return (
    <>
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>ファイルを選ぶ</div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10 }}>
          <strong>中身はサーバに送りません。</strong>先頭 64 バイトだけをブラウザで読み、シグネチャと突き合わせます。
          試すなら、画像ファイルの拡張子を <code>.pdf</code> などに変えてから選んでください。
        </p>
        <FileInput label="ファイルを選ぶ" onSelect={(files) => { const f = files[0]; if (f) void onPick(f); }} />
      </div>

      {result && (
        <div style={box}>
          <table style={{ borderCollapse: "collapse", fontSize: 12.5, marginBottom: 12 }}>
            <tbody>
              <tr>
                <td style={{ padding: "4px 12px 4px 0", color: "var(--color-muted)" }}>ファイル名</td>
                <td style={{ padding: "4px 0", fontFamily: "var(--font-mono)" }}>{result.name}</td>
              </tr>
              <tr>
                <td style={{ padding: "4px 12px 4px 0", color: "var(--color-muted)" }}>名乗っている種別</td>
                <td style={{ padding: "4px 0", fontFamily: "var(--font-mono)" }}>{result.claimedType}</td>
              </tr>
              <tr>
                <td style={{ padding: "4px 12px 4px 0", color: "var(--color-muted)" }}>中身から判定した種別</td>
                <td style={{ padding: "4px 0", fontFamily: "var(--font-mono)" }}>
                  {result.detected ? `${result.detected.ext} (${result.detected.mime})` : "判定できません（未知の形式）"}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge variant={result.matches ? "success" : "danger"}>{result.matches ? "一致" : "不一致"}</Badge>
              <span style={{ fontSize: 12.5 }}>
                {result.matches
                  ? "拡張子と中身が合っています"
                  : "拡張子と中身が違います。**改名されたファイル**の可能性があります".replace(/\*\*/g, "")}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge variant={result.allowed ? "success" : "danger"}>{result.allowed ? "許可" : "拒否"}</Badge>
              <span style={{ fontSize: 12.5 }}>
                許可リスト（{ALLOWED.join(" / ")}）に{result.allowed ? "含まれます" : "含まれません"}
              </span>
            </div>
          </div>
        </div>
      )}

      <Alert variant="info" title="拡張子と Content-Type は信用しない">
        どちらも<strong>送る側が自由に名乗れます</strong>。<code>evil.exe</code> を <code>photo.png</code> に
        改名しただけのファイルを受け入れると、サーバに実行ファイルが置かれます。
        <code>detectFileType</code> は<strong>先頭のバイト列</strong>を見るので、改名では騙せません。
        アップロードを受ける場所では必ず通してください。
      </Alert>
    </>
  );
}
