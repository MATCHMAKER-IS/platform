/**
 * パッケージのカテゴリ定義(単一情報源)。gen-module-list / migrate-packages が共用する。
 * 物理ディレクトリ移行時のスラッグも併記。
 */
export const CATEGORIES = {
  "基礎(型・共通)": ["core", "logger", "env", "config", "validation", "utils", "datetime", "context", "testing", "faker", "debug"],
  "セキュリティ": ["crypto", "security", "guard", "secrets", "pii", "apikey", "ratelimit", "access-review"],
  "認証・認可": ["auth", "session"],
  "データ": ["db", "cache", "storage", "fs", "csv", "xlsx", "search"],
  "通信": ["http", "net", "mail", "sms", "notify", "os-notify", "realtime", "integrations", "webhook"],
  "AI基盤": ["ai", "rag", "mcp"],
  "外部SaaS連携": ["zoho", "google", "microsoft", "slack", "notion", "line", "freee", "stripe", "paypal", "ekyc"],
  "非同期・フロー制御": ["jobs", "rpa", "cron", "workflow", "fsm", "blueprint", "saga", "flags"],
  "UI・表現": ["ui", "form", "report", "pdf", "print", "barcode", "i18n", "color", "html", "theme"],
  "メディア・デバイス": ["media", "image", "ocr", "upload", "device", "mobile", "bluetooth", "hid"],
  "業務ドメイン": ["address", "phone", "currency", "units", "tax", "importer", "sequence", "zengin", "payroll", "dencho", "commerce", "invoice", "quote", "purchase", "inventory", "accounting", "audit", "depreciation", "booking", "cast", "elearning", "task", "contract", "attendance"],
  "コンテンツ・サイト": ["cms", "blog", "seo", "site", "url", "social", "board", "chat", "faq"],
  "運用・可観測性": ["observability", "status-page", "analytics", "loadtest"],
};

/** 物理移行時のディレクトリ名(ASCII)。 */
export const CATEGORY_SLUGS = {
  "基礎(型・共通)": "foundation",
  "セキュリティ": "security",
  "認証・認可": "auth",
  "データ": "data",
  "通信": "comm",
  "AI基盤": "ai-core",
  "外部SaaS連携": "saas",
  "非同期・フロー制御": "flow",
  "UI・表現": "ui-kit",
  "メディア・デバイス": "media",
  "業務ドメイン": "domain",
  "コンテンツ・サイト": "content",
  "運用・可観測性": "ops",
};
