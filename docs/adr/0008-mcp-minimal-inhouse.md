# 0008: MCP は SDK 非依存の最小自作

- 日付: 2026-07-14 / 状態: 採用

## 文脈
Claude Desktop / Code から社内データを操作する MCP サーバが欲しい。公式 SDK 利用と最小自作の選択。

## 決定
`packages/mcp` として JSON-RPC 2.0 + initialize / tools を自作(約280行)。プロトコル処理は純関数、stdio は入出力注入可能。

## 検討した代替案と見送り理由
- 公式 SDK: 機能は広いが依存が増え、オフライン検証と挙動の完全把握が難しい。必要機能(tools)は小さい。

## 影響
仕様追随は自前(バージョン交渉 SUPPORTED_PROTOCOL_VERSIONS)。resources / prompts / HTTP トランスポートは必要になった時点で追加(ROADMAP)。
