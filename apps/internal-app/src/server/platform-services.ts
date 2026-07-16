import { createMemoryDeliveryLogStore, createPrismaDeliveryLogStore, type DeliveryLogStore, type DeliveryLogStoreDb } from "./delivery-log";
import { createMemoryReportPresetStore, createPrismaReportPresetStore, type ReportPresetStore, type ReportPresetStoreDb } from "./report-preset";
import { createMemoryReportScheduleStore, createPrismaReportScheduleStore, type ReportScheduleStore, type ReportScheduleStoreDb } from "./report-schedule";
import { createMemoryExportScheduleStore, createPrismaExportScheduleStore, createMemoryExportRunStore, createPrismaExportRunStore, type ExportScheduleStore, type ExportScheduleStoreDb, type ExportRunStore, type ExportRunStoreDb } from "./export-schedule";
import { createMemoryTemplateStore, createPrismaTemplateStore, type TemplateStore, type TemplateStoreDb } from "./notification-templates";
import { createMemorySearchIndexStore, createPrismaSearchIndexStore, type SearchIndexStore, type SearchIndexStoreDb } from "./search-index";
import { createMemoryDigestSettingStore, createPrismaDigestSettingStore, type DigestSettingStore, type DigestSettingStoreDb } from "./digest";
import { serverEnv, useChatPrisma } from "./env";
import { createMemoryFlagStore, createPrismaFlagStore, type FlagStore, type FlagStoreDb } from "./feature-flags";
import { createMemorySecretRecordStore, createPrismaSecretRecordStore, createAppSecretStore, type SecretRecordStore, type SecretRecordStoreDb } from "./secret-store";
import { createMemoryServiceAccountStore, createPrismaServiceAccountStore, type ServiceAccountStore, type ServiceAccountStoreDb } from "./service-account-repo";
import { createMemoryWebhookSubscriptionStore, createPrismaWebhookSubscriptionStore, type WebhookSubscriptionStore, type WebhookSubscriptionStoreDb } from "./outbound-webhook";
import { createMemoryFeatureAccessStore, createPrismaFeatureAccessStore, type FeatureAccessStore, type FeatureAccessStoreDb } from "./feature-access";
import { createMemorySignatureStore, createPrismaSignatureStore, type SignatureStore, type SignatureStoreDb } from "./signature-repo";
import { createMemoryReviewStore, createPrismaReviewStore, type ReviewStore, type ReviewStoreDb } from "./review-repo";
import { createMemorySeenStore } from "@platform/notify";
import { createMemorySurveyStore, createPrismaSurveyStore, type SurveyStore, type SurveyStoreDb } from "./survey-repo";
import { createMemorySettingsStore, createPrismaSettingsStore, type SettingsStore, type SettingsStoreDb } from "./settings-repo";
import { createMemoryUserStore, createPrismaUserStore, type UserStore, type UserStoreDb, type User } from "./user-repo";
import { createMemoryInquiryStore, createPrismaInquiryStore, type InquiryStore, type InquiryStoreDb } from "./inquiry-repo";
import { createMemoryAccountMasterStore, createPrismaAccountMasterStore, type AccountMasterStore, type AccountMasterStoreDb } from "./account-master-repo";
import { createMailer } from "@platform/mail";
import { createMemoryManualJournalStore, createPrismaManualJournalStore, type ManualJournalStore, type ManualJournalStoreDb } from "./manual-journal-repo";
import { createMemoryMailboxStore, createPrismaMailboxStore, createMailboxTransport, type MailboxStore, type MailboxStoreDb } from "./mailbox-repo";
import { createMemoryPeriodLockStore, createPrismaPeriodLockStore, type PeriodLockStore, type PeriodLockStoreDb } from "./period-lock-repo";
import { createMemoryDocApprovalStore, createPrismaDocApprovalStore, type DocApprovalStore, type DocApprovalStoreDb } from "./doc-approval-repo";
import { createMemoryReceiptStore, createPrismaReceiptStore, type ReceiptStore, type ReceiptStoreDb } from "./receipt-repo";
import { createMemoryPartnerStore, createPrismaPartnerStore, type PartnerStore, type PartnerStoreDb } from "./partner-repo";
import { createMemoryBudgetStore, createPrismaBudgetStore, type BudgetStore, type BudgetStoreDb } from "./budget-repo";
import { createMemoryAssetStore, createPrismaAssetStore, type AssetStore, type AssetStoreDb } from "./asset-repo";
import { createMemoryFeePaymentStore, createPrismaFeePaymentStore, type FeePaymentStore, type FeePaymentStoreDb } from "./withholding-repo";
import { createMemoryPurchasePaymentStore, createPrismaPurchasePaymentStore, type PurchasePaymentStore, type PurchasePaymentStoreDb } from "./payables-repo";
import { createMemoryAttendanceApprovalStore, createPrismaAttendanceApprovalStore, type AttendanceApprovalStore, type AttendanceApprovalStoreDb } from "./attendance-approval-repo";
import { createMemoryWageStore, createPrismaWageStore, type WageStore, type WageStoreDb } from "./payroll-repo";
import { createMemoryAttendanceStore, createPrismaAttendanceStore, type AttendanceStore, type AttendanceStoreDb } from "./attendance-repo";
import { createMemoryRecurringStore, createPrismaRecurringStore, type RecurringStore, type RecurringStoreDb } from "./recurring-repo";
import { createMemoryPurchaseStore, createPrismaPurchaseStore, type PurchaseStore, type PurchaseStoreDb } from "./purchase-repo";
import { createMemoryQuoteStore, createPrismaQuoteStore, type QuoteStore, type QuoteStoreDb } from "./quote-repo";
import { createMemoryInvoiceStore, createPrismaInvoiceStore, type InvoiceStore, type InvoiceStoreDb } from "./invoice-repo";
import { createMemoryInventoryStore, createPrismaInventoryStore, type InventoryStore, type InventoryStoreDb } from "./inventory-repo";
/**
 * 通知センター・ファイル管理・監査ログの配線（シングルトン）。
 * 既定インメモリ、`CHAT_PERSISTENCE=prisma` で通知/ファイルは Prisma 実装に切り替わる。
 * @packageDocumentation
 */
import { createStorage, createLocalStorage } from "@platform/storage";
import {
  createMemoryNotificationStore,
  createPrismaNotificationStore,
  createNotificationCenter,
  type NotificationStore,
  type NotificationCenter,
  type NotificationStoreDb,
} from "./notification-center";
import {
  createMemoryFileRegistry,
  createPrismaFileRegistry,
  createFileManager,
  type FileRegistry,
  type FileManager,
  type FileRegistryDb,
} from "./file-manager";
import { createMemoryAuditStore, createPrismaAuditStore, createAuditLog, type AuditLog, type AuditStoreDb } from "./audit-log";
import { createAuditActions, type AuditActions } from "./audit-actions";
import { createMemoryPreferenceStore, createPrismaPreferenceStore, type PreferenceStore, type PreferenceStoreDb } from "./notification-prefs";
import { createMemoryAnalyticsStore, createPrismaAnalyticsStore, createAnalytics, type Analytics, type AnalyticsStoreDb } from "./analytics-store";
import { createMemoryDashboardPrefStore, createPrismaDashboardPrefStore, type DashboardPrefStore, type DashboardPrefStoreDb } from "./dashboard-prefs";
import { createMemoryCmsStore, createPrismaCmsStore, type CmsStore, type CmsStoreDb } from "./cms-store";
import { createMemoryPageStore, createPrismaPageStore, createMemoryAnnouncementStore, createPrismaAnnouncementStore, createMemoryCategoryStore, createPrismaCategoryStore, createMemoryRevisionStore, createPrismaRevisionStore, createMemoryPublishRequestStore, createPrismaPublishRequestStore, type PageStore, type PageStoreDb, type AnnouncementStore, type AnnouncementStoreDb, type CategoryStore, type CategoryStoreDb, type RevisionStore, type RevisionStoreDb, type PublishRequestStore, type PublishRequestStoreDb } from "@platform/cms";
import { db } from "./services";

const usePrisma = useChatPrisma;
let idSeq = 0;
const newId = (p: string) => () => `${p}_${Date.now()}_${++idSeq}`;

/** 通知ストア。 */
export const notificationStore: NotificationStore = usePrisma
  ? createPrismaNotificationStore(db as unknown as NotificationStoreDb)
  : createMemoryNotificationStore();

/** 通知センター。 */
export const notificationCenter: NotificationCenter = createNotificationCenter(notificationStore, newId("ntf"));

/** ファイル用ストレージ（本番は S3 等に差し替え）。 */
export const fileStorage = createStorage(createLocalStorage("/tmp/platform-files"));

/** ファイルメタのレジストリ。 */
export const fileRegistry: FileRegistry = usePrisma
  ? createPrismaFileRegistry(db as unknown as FileRegistryDb)
  : createMemoryFileRegistry();

/** ファイル管理サービス。 */
export const fileManager: FileManager = createFileManager({ storage: fileStorage, registry: fileRegistry });

/** 監査ログ（CHAT_PERSISTENCE=prisma で Prisma 永続化・チェーン検証）。 */
export const auditLog: AuditLog = createAuditLog(
  usePrisma ? createPrismaAuditStore(db as unknown as AuditStoreDb) : createMemoryAuditStore(),
);

/** 監査アクション記録（各業務操作の入口から呼ぶ）。 */
export const auditActions: AuditActions = createAuditActions(auditLog);

/** 通知プレファレンスストア（CHAT_PERSISTENCE=prisma で Prisma 実装）。 */
export const preferenceStore: PreferenceStore = usePrisma
  ? createPrismaPreferenceStore(db as unknown as PreferenceStoreDb)
  : createMemoryPreferenceStore();

/** アクセス解析（CHAT_PERSISTENCE=prisma で Prisma 実装）。 */
export const analytics: Analytics = createAnalytics(
  usePrisma ? createPrismaAnalyticsStore(db as unknown as AnalyticsStoreDb) : createMemoryAnalyticsStore(),
);

/** ダッシュボードのウィジェット表示設定（CHAT_PERSISTENCE=prisma で Prisma 実装）。 */
export const dashboardPrefStore: DashboardPrefStore = usePrisma
  ? createPrismaDashboardPrefStore(db as unknown as DashboardPrefStoreDb)
  : createMemoryDashboardPrefStore();

/** 公開サイトの記事を管理する CMS ストア（CHAT_PERSISTENCE=prisma で Prisma 実装）。 */
export const cmsStore: CmsStore = usePrisma
  ? createPrismaCmsStore(db as unknown as CmsStoreDb)
  : createMemoryCmsStore();

/** 固定ページの管理ストア。 */
export const pageStore: PageStore = usePrisma
  ? createPrismaPageStore(db as unknown as PageStoreDb)
  : createMemoryPageStore();

/** お知らせの管理ストア。 */
export const announcementStore: AnnouncementStore = usePrisma
  ? createPrismaAnnouncementStore(db as unknown as AnnouncementStoreDb)
  : createMemoryAnnouncementStore();

/** カテゴリの管理ストア。 */
export const categoryStore: CategoryStore = usePrisma
  ? createPrismaCategoryStore(db as unknown as CategoryStoreDb)
  : createMemoryCategoryStore();

/** 記事のリビジョン(変更履歴)ストア。 */
export const revisionStore: RevisionStore = usePrisma
  ? createPrismaRevisionStore(db as unknown as RevisionStoreDb)
  : createMemoryRevisionStore();

/** 公開申請ストア。 */
export const publishRequestStore: PublishRequestStore = usePrisma
  ? createPrismaPublishRequestStore(db as unknown as PublishRequestStoreDb)
  : createMemoryPublishRequestStore();

/** 在庫ストア。 */
export const inventoryStore: InventoryStore = usePrisma
  ? createPrismaInventoryStore(db as unknown as InventoryStoreDb)
  : createMemoryInventoryStore();

/** 請求書ストア。 */
export const invoiceStore: InvoiceStore = usePrisma
  ? createPrismaInvoiceStore(db as unknown as InvoiceStoreDb)
  : createMemoryInvoiceStore();

/** 見積ストア。 */
export const quoteStore: QuoteStore = usePrisma
  ? createPrismaQuoteStore(db as unknown as QuoteStoreDb)
  : createMemoryQuoteStore();

/** 発注ストア。 */
export const purchaseStore: PurchaseStore = usePrisma
  ? createPrismaPurchaseStore(db as unknown as PurchaseStoreDb)
  : createMemoryPurchaseStore();

/** 繰り返し請求ストア。 */
export const recurringStore: RecurringStore = usePrisma
  ? createPrismaRecurringStore(db as unknown as RecurringStoreDb)
  : createMemoryRecurringStore();

/** 勤怠ストア。 */
export const attendanceStore: AttendanceStore = usePrisma
  ? createPrismaAttendanceStore(db as unknown as AttendanceStoreDb)
  : createMemoryAttendanceStore();

/** 給与設定ストア。 */
export const wageStore: WageStore = usePrisma
  ? createPrismaWageStore(db as unknown as WageStoreDb)
  : createMemoryWageStore();

/** 勤怠承認ストア。 */
export const attendanceApprovalStore: AttendanceApprovalStore = usePrisma
  ? createPrismaAttendanceApprovalStore(db as unknown as AttendanceApprovalStoreDb)
  : createMemoryAttendanceApprovalStore();

/** 発注の支払記録ストア（買掛金）。 */
export const purchasePaymentStore: PurchasePaymentStore = usePrisma
  ? createPrismaPurchasePaymentStore(db as unknown as PurchasePaymentStoreDb)
  : createMemoryPurchasePaymentStore();

/** 報酬支払ストア（源泉徴収・支払調書）。 */
export const feePaymentStore: FeePaymentStore = usePrisma
  ? createPrismaFeePaymentStore(db as unknown as FeePaymentStoreDb)
  : createMemoryFeePaymentStore();

/** 固定資産ストア。 */
export const assetStore: AssetStore = usePrisma
  ? createPrismaAssetStore(db as unknown as AssetStoreDb)
  : createMemoryAssetStore();

/** 予算ストア。 */
export const budgetStore: BudgetStore = usePrisma
  ? createPrismaBudgetStore(db as unknown as BudgetStoreDb)
  : createMemoryBudgetStore();

/** 取引先マスタストア。 */
export const partnerStore: PartnerStore = usePrisma
  ? createPrismaPartnerStore(db as unknown as PartnerStoreDb)
  : createMemoryPartnerStore();

/** 入金記録ストア（日付つき・資金繰り用）。 */
export const receiptStore: ReceiptStore = usePrisma
  ? createPrismaReceiptStore(db as unknown as ReceiptStoreDb)
  : createMemoryReceiptStore();

/** 伝票承認ストア（発注・請求の多段承認）。 */
export const docApprovalStore: DocApprovalStore = usePrisma
  ? createPrismaDocApprovalStore(db as unknown as DocApprovalStoreDb)
  : createMemoryDocApprovalStore();

/** 月次締めロックストア。 */
export const periodLockStore: PeriodLockStore = usePrisma
  ? createPrismaPeriodLockStore(db as unknown as PeriodLockStoreDb)
  : createMemoryPeriodLockStore();

/** 受信箱ストア。 */
export const mailboxStore: MailboxStore = usePrisma
  ? createPrismaMailboxStore(db as unknown as MailboxStoreDb)
  : createMemoryMailboxStore();

/** アプリのメール送信口（受信箱へ配送する Transport を使用）。 */
export const appMailer = createMailer({ transport: createMailboxTransport(mailboxStore), defaultFrom: "no-reply@example.com" });

/** 手動仕訳（決算整理・調整）ストア。 */
export const manualJournalStore: ManualJournalStore = usePrisma
  ? createPrismaManualJournalStore(db as unknown as ManualJournalStoreDb)
  : createMemoryManualJournalStore();

/** 勘定科目マスタストア（科目→区分。P/L・B/S 反映に使用）。 */
export const accountMasterStore: AccountMasterStore = usePrisma
  ? createPrismaAccountMasterStore(db as unknown as AccountMasterStoreDb)
  : createMemoryAccountMasterStore();

/** お問い合わせストア。 */
export const inquiryStore: InquiryStore = usePrisma
  ? createPrismaInquiryStore(db as unknown as InquiryStoreDb)
  : createMemoryInquiryStore();

/** ユーザー・権限ディレクトリ（管理画面）。初期は管理者1名をシード。 */
const USER_SEED: User[] = [{ email: "admin@example.com", name: "管理者", department: "経営", roles: ["admin"], permissions: [], active: true, createdAt: "2025-01-01T00:00:00.000Z" }];
export const userStore: UserStore = usePrisma
  ? createPrismaUserStore(db as unknown as UserStoreDb)
  : createMemoryUserStore(USER_SEED);

/** システム設定ストア。 */
export const settingsStore: SettingsStore = usePrisma
  ? createPrismaSettingsStore(db as unknown as SettingsStoreDb)
  : createMemorySettingsStore();

/** アンケートストア。 */
export const surveyStore: SurveyStore = usePrisma
  ? createPrismaSurveyStore(db as unknown as SurveyStoreDb)
  : createMemorySurveyStore();

/** 監査アラートの重複抑制ストア（プロセス内・定期スキャン間で共有）。 */
export const alertSeenStore = createMemorySeenStore();

/** 口コミ（レビュー）ストア。 */
export const reviewStore: ReviewStore = usePrisma
  ? createPrismaReviewStore(db as unknown as ReviewStoreDb)
  : createMemoryReviewStore();

/** 手書きサインストア。 */
export const signatureStore: SignatureStore = usePrisma
  ? createPrismaSignatureStore(db as unknown as SignatureStoreDb)
  : createMemorySignatureStore();

/** 機能アクセス（役割別 有効/無効）ストア。 */
export const featureAccessStore: FeatureAccessStore = usePrisma
  ? createPrismaFeatureAccessStore(db as unknown as FeatureAccessStoreDb)
  : createMemoryFeatureAccessStore();

/** 送信 Webhook 購読ストア。 */
export const webhookSubscriptionStore: WebhookSubscriptionStore = usePrisma
  ? createPrismaWebhookSubscriptionStore(db as unknown as WebhookSubscriptionStoreDb)
  : createMemoryWebhookSubscriptionStore();

/** サービスアカウント（APIキー）ストア。 */
export const serviceAccountStore: ServiceAccountStore = usePrisma
  ? createPrismaServiceAccountStore(db as unknown as ServiceAccountStoreDb)
  : createMemoryServiceAccountStore();

/** 秘密情報の暗号文ストア。 */
export const secretRecordStore: SecretRecordStore = usePrisma
  ? createPrismaSecretRecordStore(db as unknown as SecretRecordStoreDb)
  : createMemorySecretRecordStore();

/** マスター暗号鍵（env SECRET_MASTER_KEY、無ければ SESSION_SECRET を流用）。 */
const SECRET_MASTER_KEY = serverEnv.SECRET_MASTER_KEY;

/** アプリの秘密取得ストア（DB→環境変数チェーン・TTLキャッシュ）。 */
export const appSecretStore = createAppSecretStore(secretRecordStore, SECRET_MASTER_KEY, (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {});

/** フィーチャーフラグ定義ストア。 */
export const flagStore: FlagStore = usePrisma
  ? createPrismaFlagStore(db as unknown as FlagStoreDb)
  : createMemoryFlagStore();

/** ダイジェスト設定ストア。 */
export const digestSettingStore: DigestSettingStore = usePrisma
  ? createPrismaDigestSettingStore(db as unknown as DigestSettingStoreDb)
  : createMemoryDigestSettingStore();

/** 検索インデックスストア（永続化）。 */
export const searchIndexStore: SearchIndexStore = usePrisma
  ? createPrismaSearchIndexStore(db as unknown as SearchIndexStoreDb)
  : createMemorySearchIndexStore();

/** 通知テンプレート上書きストア。 */
export const templateStore: TemplateStore = usePrisma
  ? createPrismaTemplateStore(db as unknown as TemplateStoreDb)
  : createMemoryTemplateStore();

/** エクスポートのスケジュールと履歴。 */
export const exportScheduleStore: ExportScheduleStore = usePrisma
  ? createPrismaExportScheduleStore(db as unknown as ExportScheduleStoreDb)
  : createMemoryExportScheduleStore();
export const exportRunStore: ExportRunStore = usePrisma
  ? createPrismaExportRunStore(db as unknown as ExportRunStoreDb)
  : createMemoryExportRunStore();

/** レポート配信スケジュールストア。 */
export const reportScheduleStore: ReportScheduleStore = usePrisma
  ? createPrismaReportScheduleStore(db as unknown as ReportScheduleStoreDb)
  : createMemoryReportScheduleStore();

/** レポートプリセットストア。 */
export const reportPresetStore: ReportPresetStore = usePrisma
  ? createPrismaReportPresetStore(db as unknown as ReportPresetStoreDb)
  : createMemoryReportPresetStore();

/** レポート配信ログストア。 */
export const deliveryLogStore: DeliveryLogStore = usePrisma
  ? createPrismaDeliveryLogStore(db as unknown as DeliveryLogStoreDb)
  : createMemoryDeliveryLogStore();
