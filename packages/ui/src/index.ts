/**
 * `@platform/ui` — 共通 UI 部品(shadcn/ui + Radix ラッパー)。
 * デザイントークン(`tokens.css`)で配色・角丸・フォントを一元管理する。
 * @packageDocumentation
 */

// 基本・フォーム
export { Button, buttonVariants, type ButtonProps } from "./components/button";
export { SocialLoginButton, type SocialLoginButtonProps, type SocialProvider } from "./components/social-login-button";
export { SocialLoginGroup, type SocialLoginGroupProps, LoginDivider, type LoginDividerProps } from "./components/social-login-group";
export { LoginCard, type LoginCardProps } from "./components/login-card";
export { EmailLoginForm, type EmailLoginFormProps, type EmailLoginValues } from "./components/email-login-form";
export { validateEmailLogin, isEmailLike, isLoginFormValid, type LoginFormErrors } from "./lib/login-form";
export { PROVIDER_LABELS, socialLoginLabel, PROVIDER_AUTH_BACKEND } from "./lib/social-login";
export { Input, type InputProps } from "./components/input";
export { Textarea, type TextareaProps } from "./components/textarea";
export { PasswordInput, type PasswordInputProps } from "./components/password-input";
export { VoiceInput, type VoiceInputProps } from "./components/voice-input";
export { useSpeechRecognition, type SpeechRecognitionState, type UseSpeechRecognitionOptions } from "./components/use-speech-recognition";
export { PasswordStrengthMeter, type PasswordStrengthMeterProps } from "./components/password-strength-meter";
export { Select, type SelectProps, type SelectOption } from "./components/select";
export { Checkbox, type CheckboxProps } from "./components/checkbox";
export { Switch, type SwitchProps } from "./components/switch";
export { Slider, type SliderProps } from "./components/slider";

// 選択・トグル
export { RadioGroup, RadioGroupItem } from "./components/radio-group";
export { ToggleGroup, ToggleGroupItem } from "./components/toggle-group";
export { NumberInput, type NumberInputProps } from "./components/number-input";
export { DatePicker, TimePicker, DateTimePicker } from "./components/date-picker";
export { ColorPicker, type ColorPickerProps } from "./components/color-picker";
export { FileUpload, type FileUploadProps } from "./components/file-upload";
export { FileUploader, type FileUploaderProps } from "./components/file-uploader";
export { useUpload, type UseUploadOptions, type UploadResult } from "./components/use-upload";

// メニュー・選択
export { Combobox, type ComboboxProps, type ComboboxOption } from "./components/combobox";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./components/dropdown";

// オーバーレイ
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
  DialogClose,
} from "./components/dialog";
export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./components/tooltip";

// 表示
export { Carousel, type CarouselProps } from "./components/carousel";

// フィードバック・状態
export { Spinner, LoadingOverlay, type SpinnerProps } from "./components/spinner";
export { Progress, Seekbar, type SeekbarProps } from "./components/progress";
export { Steps, type StepsProps } from "./components/steps";
export { Toaster, toast } from "./components/toast";

// ダイアログ
export { Modal, type ModalProps } from "./components/modal";
export {
  ConfirmDialog, ErrorDialog,
  type ConfirmDialogProps, type ErrorDialogProps,
} from "./components/confirm-dialog";

// データ表示

// 高度な入力
export { NumericKeypad, type NumericKeypadProps } from "./components/numpad";
export { SoftwareKeyboard, type SoftwareKeyboardProps } from "./components/software-keyboard";
export { RichTextEditor, type RichTextEditorProps } from "./components/rich-text-editor";

// ナビ・レイアウト・表示
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs";
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./components/accordion";
export { Avatar, AvatarImage, AvatarFallback } from "./components/avatar";
export { Badge, badgeVariants, type BadgeProps } from "./components/badge";
export { Skeleton } from "./components/skeleton";
export { Breadcrumb, type BreadcrumbProps, type BreadcrumbItem } from "./components/breadcrumb";
export { Pagination, SimplePagination, type PaginationProps, type SimplePaginationProps } from "./components/pagination";
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardGrid, type CardGridProps } from "./components/card";
export { List, ListItem, type ListItemProps } from "./components/list";
export { Block, BlockGrid, type BlockProps, type BlockGridProps } from "./components/block";
export { BackToTop, type BackToTopProps } from "./components/back-to-top";
export { DataView, ViewToggle, type DataViewProps, type ViewToggleProps, type ViewMode } from "./components/data-view";

// 高度な入力(評価・サジェスト・タグ・OTP・署名)
export { Rating, type RatingProps } from "./components/rating";
export { Autocomplete, type AutocompleteProps } from "./components/autocomplete";
export { TagInput, type TagInputProps } from "./components/tag-input";
export { OTPInput, type OTPInputProps } from "./components/otp-input";
export { SignaturePad, type SignaturePadProps } from "./components/signature-pad";

// メディアプレイヤー
export { VideoPlayer, type VideoPlayerProps } from "./components/video-player";
export { AudioPlayer, type AudioPlayerProps } from "./components/audio-player";
export { StreamPlayer, type StreamPlayerProps } from "./components/stream-player";
export { AudioRecorder, type AudioRecorderProps } from "./components/audio-recorder";
export { VideoRecorder, type VideoRecorderProps } from "./components/video-recorder";
export { AudioVisualizer, type AudioVisualizerProps } from "./components/audio-visualizer";
export { Waveform, type WaveformProps } from "./components/waveform";
export { formatTime } from "./lib/format-time";

// ユーティリティ
export { Icon, iconNames, hasIcon, type IconProps, type IconName } from "./components/icon";
export { useClientInfo } from "./components/use-client-info";
export { useBluetooth, type UseBluetoothState } from "./components/use-bluetooth";
export { useHid, type UseHidState } from "./components/use-hid";
// グラフ(チャート)
export {
  BarChart, LineChart, ComboChart, PieChart, RadarChart, ScatterChart, GanttChart,
  Heatmap, Treemap, FunnelChart, ChartCard,
  CandlestickChart, BubbleChart, BandChart, HorizontalBarChart,
  WaterfallChart, SankeyChart, ProgressRing,
  SeriesToggle, useSeriesVisibility, toGanttRows, CHART_COLORS,
  type SeriesDef, type BaseChartProps, type CartesianChartProps, type PieChartProps,
  type RadarChartProps, type ScatterChartProps, type ScatterSeries, type GanttChartProps,
  type GanttTask, type GanttRow, type HeatmapProps, type TreemapProps, type FunnelChartProps, type ChartCardProps,
  type CandlestickChartProps, type Candlestick, type BubbleChartProps, type BubbleSeries, type BandChartProps,
  type WaterfallChartProps, type SankeyChartProps, type ProgressRingProps,
} from "./components/charts/index";
export { usePrint, type UsePrintResult } from "./components/use-print";
export { PrintButton, type PrintButtonProps } from "./components/print-button";
export { CsvExportButton, type CsvExportButtonProps } from "./components/csv-export-button";
export { elementToPng, type ExportPngOptions } from "./lib/export-image";
// 画像処理(ブラウザ Canvas)
export {
  loadImage, resizeImage, cropImage, pixelate, applyFilters, flipImage,
  convertFormat, removeBackgroundColor, maskImage, downloadBlob, type ImageFilters,
} from "./lib/image";
export { rectFromPoints, displayToNaturalRect, type Rect } from "./lib/crop";
export { ImageCropper, type ImageCropperProps } from "./components/image-cropper";
export { useImageUpload, type UseImageUploadOptions, type UseImageUploadResult } from "./components/use-image-upload";
export { FieldReview, type FieldReviewProps } from "./components/field-review";
export { classifyConfidence, bucketWords, countByTier, resolveThresholds, CONFIDENCE_PROFILES, type ConfidenceTier, type ConfidenceThresholds, type ConfidenceProfile } from "./lib/confidence";
export { ConfidenceHighlight, type ConfidenceHighlightProps, type ConfidenceToken } from "./components/confidence-highlight";
export { Highlight, type HighlightProps } from "./components/highlight";
export { LogViewer, type LogViewerProps } from "./components/log-viewer";
export { Sparkline, type SparklineProps } from "./components/sparkline";
// Histogram / Gauge は components/ 直下のもの(target を持つ)を主とする。
// charts/ のものは min/max 基準の別物なので、別名で出す。
export { Histogram, type HistogramProps } from "./components/histogram";
export { Histogram as ChartHistogram, type HistogramProps as ChartHistogramProps } from "./components/charts/band-histogram";
export { Gauge as ChartGauge, type GaugeProps as ChartGaugeProps } from "./components/charts/gauge";
export { StatSummary, type StatSummaryProps } from "./components/stat-summary";
export { BoxPlot, type BoxPlotProps } from "./components/box-plot";
export { Trend, type TrendProps } from "./components/trend";
export { Gauge, type GaugeProps } from "./components/gauge";
export { KpiCard, type KpiCardProps } from "./components/kpi-card";
export { DonutChart, type DonutChartProps, type DonutDatum } from "./components/donut-chart";
export { BreakdownBar, type BreakdownBarProps, type BreakdownSegment } from "./components/breakdown-bar";
export { RankingList, type RankingListProps, type RankingItem } from "./components/ranking-list";
export { GoalProgress, type GoalProgressProps } from "./components/goal-progress";
export { Funnel, type FunnelProps, type FunnelStep } from "./components/funnel";
export { FreshnessIndicator, type FreshnessIndicatorProps } from "./components/freshness-indicator";
export { MetricGrid, type MetricGridProps } from "./components/metric-grid";
export { Scatter, type ScatterProps, type ScatterPoint } from "./components/scatter";
export { TimelineChart, type TimelineChartProps, type TimelineSeries, type TimelineBand } from "./components/timeline-chart";
export { createLogStream, type LogStream, type LogStreamOptions } from "./lib/log-stream";
export { useLogStream } from "./components/use-log-stream";
export { detectLogLevel, parseLogLines, filterLogLines, countByLevel, extractTimestamp, bucketByTime, logLinesToText, formatRelativeTime, parseStructuredLog, firstLineIndexAtOrAfter, collectFieldKeys, fieldFacets, filterByFields, appendCapped, LOG_LEVELS, type LogLevel, type LogLine, type LogFilter, type TimeBucket, type StructuredLog } from "./lib/log";
export { OcrFeedbackDashboard, type OcrFeedbackDashboardProps } from "./components/ocr-feedback-dashboard";
export { LocaleProvider, useI18n, useT, type LocaleProviderProps } from "./components/i18n-provider";
export { createLocalStorageLocaleStore, createFetchLocaleStore, isLocale, type LocaleStore } from "./lib/locale-store";
export { useLocalePreference } from "./components/use-locale";
export { collectCorrections, buildOcrFeedback, createOcrFeedbackStore, aggregateOcrFeedback, type FieldCorrection, type OcrFeedback, type OcrFeedbackStore, type FeedbackAggregate, type FieldFeedbackStat } from "./lib/ocr-feedback";
export { splitByConfidence, needsReview, type ReviewField } from "./lib/field-review";
// Column は DataTableColumn の別名(既存コードが Column を使っているため残す)。
export { DataTable, type DataTableProps, type DataTableColumn, type DataTableColumn as Column } from "./components/data-table";
export { queryRows, type TableQuery, type TableResult } from "./lib/table";
export { SheetGrid, type SheetGridProps, type SheetColumn } from "./components/sheet-grid";
export { normalizeCellRange, inRange, rangeToTsv, stickyLeftOffsets, applyColumnResize, computeVisibleRange, computeVisibleColumns, parseTsv, tsvToRows, type CellPos, type CellRange } from "./lib/grid";
export { validateImportRows, cellErrorLookup, errorRowIndices, filterErrorRows, summarizeImport, buildImportHistory, canRollback, canRollbackWith, validRows, partitionRows, type ImportField, type ImportValidation, type CellError, type FieldType, type ImportSummary, type ImportHistoryRow } from "./lib/import-validate";
export { ImportHistoryTable, type ImportHistoryTableProps } from "./components/import-history-table";
export { ImportHistoryDetail, type ImportHistoryDetailProps } from "./components/import-history-detail";
export { ImportReview, type ImportReviewProps } from "./components/import-review";
export { diffRecords, type RowDiff, type ChangedRow } from "./lib/diff";
export { DiffPreview, type DiffPreviewProps } from "./components/diff-preview";
export { applyColumnPrefs, toggleColumnHidden, moveColumn, emptyColumnPrefs, createColumnPrefsStore, type ColumnPrefs, type ColumnPrefsStore, type ColumnPrefsStoreOptions } from "./lib/column-prefs";
export { useColumnPrefs } from "./components/use-column-prefs";
export { ColumnSettings, type ColumnSettingsProps } from "./components/column-settings";
export { upsertPreset, removePreset, findPreset, splitPresets, defaultPreset, resolveInitialPrefs, createColumnPresetStore, type ColumnPreset, type ColumnPresetStore } from "./lib/column-presets";
export { ColumnPresets, type ColumnPresetsProps } from "./components/column-presets";
export { RecipientManager, type RecipientManagerProps } from "./components/recipient-manager";
export { upsertRecipient, removeRecipient, isValidEmail, validRecipients, recipientsToRows, recipientsFromRows, type Recipient } from "./lib/recipients";
export { DashboardGrid, DashboardWidget, StatCard, type DashboardGridProps, type DashboardWidgetProps, type StatCardProps } from "./components/dashboard";
export { DraggableDashboard, useDashboardLayout, type DraggableDashboardProps } from "./components/draggable-dashboard";
export { reorder, clampSpan, pxToColSpan, setColSpan, type LayoutItem, type DashboardLayout } from "./lib/layout";
export { createLocalStorageLayoutStore, createFetchLayoutStore, type LayoutStore, type FetchLayoutStoreOptions } from "./lib/layout-store";
export { appendCapped as appendItemCapped, appendManyCapped } from "./lib/live-buffer";
export { usePolling, useWebSocket, useLiveSeries, type UsePollingOptions, type WsStatus } from "./components/use-live";
export { useTween, useSpring, useInView, type UseTweenOptions, type UseInViewOptions } from "./components/use-animation";

export { cn } from "./lib/cn";
export { sparklineData, histogramData, movingAverageData, cumulativeData } from "./lib/chart-data";
export { computeShares, donutSegments, achievementRate, funnelStages, relativeTime, type Share, type DonutSegment, type FunnelStage } from "./lib/dashboard";
export { MiniCalendar, type MiniCalendarProps } from "./components/mini-calendar";
export { DateRangePicker, type DateRangePickerProps, type PickedRange } from "./components/date-range-picker";
export { CalendarHeatmap, type CalendarHeatmapProps } from "./components/calendar-heatmap";

// ── 追加コンポーネント(業務アプリ定番の欠け部品)──
export { Separator, type SeparatorProps } from "./components/separator";
export { Alert, type AlertProps } from "./components/alert";
export { ScrollArea, type ScrollAreaProps, useScrolledToBottom } from "./components/scroll-area";
export { TermsAcceptance, type TermsAcceptanceProps } from "./components/terms-acceptance";
export { EmptyState, type EmptyStateProps } from "./components/empty-state";
export { DescriptionList, type DescriptionListProps, type DescriptionItem } from "./components/description-list";
export { ActivityTimeline, type ActivityTimelineProps, type TimelineItem, type TimelineStatus } from "./components/activity-timeline";
export { Drawer, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, type DrawerContentProps, type DrawerSide } from "./components/drawer";

// ── 提案追加 + ダッシュボード部品 ──
export { Popover, PopoverTrigger, PopoverClose, PopoverAnchor, PopoverContent, type PopoverContentProps } from "./components/popover";
export { ButtonGroup, type ButtonGroupProps } from "./components/button-group";
export { SearchInput, type SearchInputProps } from "./components/search-input";
export { Tree, type TreeProps, type TreeNode } from "./components/tree";
export { toggleExpanded, collectAllIds, findNode, pathToNode } from "./lib/tree";
export { AppShell, SidebarNav, type AppShellProps, type SidebarNavProps, type SidebarNavItem } from "./components/app-shell";
export { AppHeader, type AppHeaderProps, HeaderNav, type HeaderNavProps } from "./components/app-header";
export { HamburgerButton, type HamburgerButtonProps } from "./components/hamburger-button";
export { NavMenu, type NavMenuProps } from "./components/nav-menu";
export { SiteFooter, type SiteFooterProps, type FooterLinkGroup } from "./components/site-footer";
export { UserMenu, type UserMenuProps, type UserMenuItem } from "./components/user-menu";
export { NotificationBell, type NotificationBellProps } from "./components/notification-bell";
export { CommandPalette, type CommandPaletteProps } from "./components/command-palette";
export { ContextMenu, type ContextMenuProps, type ContextMenuItem, useDisableContextMenu } from "./components/context-menu";
export { CopyButton, type CopyButtonProps, useCopyToClipboard, usePaste } from "./components/copy-button";
export { ErrorBoundary, type ErrorBoundaryProps } from "./components/error-boundary";
export { useKeyboardShortcuts, type ShortcutBinding } from "./components/use-keyboard-shortcuts";
export { parseShortcut, matchShortcut, formatShortcut, isSequence, parseSequence, sequenceMatches, type ParsedShortcut, type KeyChord } from "./lib/shortcut";
export { copyToClipboard, readClipboard } from "./lib/clipboard";
export { useNotifications, type UseNotificationsOptions, type UseNotificationsResult } from "./components/use-notifications";
export { filterCommands, groupCommands, scoreCommand, nextIndex, type Command } from "./lib/command";
export { notificationReducer, type NotificationAction, type NotificationReducerOptions } from "./lib/notification-store";
export { unreadCount, markRead, markAllRead, sortNotifications, groupByDate, type AppNotification, type NotificationKind } from "./lib/notifications";
export { PageHeader, type PageHeaderProps } from "./components/page-header";
export { ThemeToggle, type ThemeToggleProps } from "./components/theme-toggle";
export { ThemeProvider, useTheme, type ThemeProviderProps, type ThemeContextValue } from "./components/theme-provider";
export { SkinProvider, useSkin, SKIN_STORAGE_KEY, type SkinProviderProps, type SkinContextValue } from "./components/skin-provider";
export { SkinSelector, type SkinSelectorProps } from "./components/skin-selector";
export { AppSkin, type AppSkinProps } from "./components/app-skin";
export { ThemeSwitcher, type ThemeSwitcherProps } from "./components/theme-switcher";
export { EnvSettingsTable, type EnvSettingsTableProps, type EnvSettingRow } from "./components/env-settings-table";
export { resolveTheme, nextThemePreference, toggleTheme, applyTheme, THEME_LABELS, THEME_STORAGE_KEY, themeInitScript, type ThemePreference, type ResolvedTheme } from "./lib/theme";
export { isNavActive, findActiveNav, flattenNav, hasActiveChild, filterNavByPermission, type NavItem } from "./lib/nav";
export { NoticeBoard, type NoticeBoardProps, type NoticeItem, type NoticeLevel } from "./components/notice-board";
export { Kanban, type KanbanProps, type KanbanColumn, type KanbanCard } from "./components/kanban";
export { moveCard, countByColumn, type KanbanCardLike, type KanbanColumnLike } from "./lib/kanban";

// ── スケジュール/カレンダー(閲覧用・Google カレンダー風)──
export { ScheduleCalendar, type ScheduleCalendarProps, type CalendarView } from "./components/schedule-calendar";
export {
  buildMonthGrid, eventsForDay, eventIntersectsDay, layoutDayEvents, groupEventsByDay, formatEventTime, formatHourLabel,
  type CalendarEvent, type PositionedEvent, type MonthCell,
} from "./lib/schedule";
export { CalendarLegend, type CalendarLegendProps, type CalendarCategory } from "./components/calendar-legend";
export {
  mergeIntervals, computeBusyIntervals, computeFreeSlots, findAvailableSlots, totalBusyMinutes, nowOffset,
  type TimeInterval,
} from "./lib/schedule";
export { EventDetailCard, type EventDetailCardProps } from "./components/event-detail-card";
export { ResourceSchedule, type ResourceScheduleProps } from "./components/resource-schedule";
export { eventsForResource, layoutResourceDay, type CalendarResource } from "./lib/schedule";
export { BlueprintActions, type BlueprintActionsProps, type BlueprintAction, type BlueprintStateStyle } from "./components/blueprint-actions";
export { MessageBubble, type MessageBubbleProps } from "./components/message-bubble";
export { MessageList, type MessageListProps, type DisplayMessage, type MessageGroup } from "./components/message-list";
export { MessageComposer, type MessageComposerProps } from "./components/message-composer";
export { ChatWindow, type ChatWindowProps } from "./components/chat-window";
export { PostCard, type PostCardProps, type ReactionCount } from "./components/post-card";
export { AttachmentList, type AttachmentListProps, type AttachmentItem } from "./components/attachment-list";
export { HighlightedText, type HighlightedTextProps } from "./components/highlighted-text";
export { highlightSegments, queryTerms, type HighlightSegment } from "./lib/highlight";
export { PinnedBanner, type PinnedBannerProps, type PinnedItem } from "./components/pinned-banner";
export { FileList, type FileListProps, type FileListItem } from "./components/file-list";
export { AuditLogView, type AuditLogViewProps, type AuditLogRow, type AuditVerification } from "./components/audit-log-view";
export { formatBytes } from "./lib/format-bytes";
// StatCard は dashboard.js のもの(delta / trend / format を持つ)を主とする。
// stat-card.js のものは hint / href を持つ別物なので、別名で出す。
export { StatCard as SimpleStatCard, type StatCardProps as SimpleStatCardProps } from "./components/stat-card";
export { NotificationPreferences, type NotificationPreferencesProps, type PreferenceValue, type PrefChannel, type PrefMode } from "./components/notification-preferences";
export { AuditEntryDetail, type AuditEntryDetailProps, type FieldChangeView } from "./components/audit-entry-detail";
export { DashboardSettings, type DashboardSettingsProps } from "./components/dashboard-settings";
export { BannerAd, type BannerAdProps } from "./components/banner-ad";
export { Eyecatch, type EyecatchProps } from "./components/eyecatch";
export { CtaButton, type CtaButtonProps } from "./components/cta-button";
export { CopyrightNotice, type CopyrightNoticeProps } from "./components/copyright-notice";
export { SocialShare, type SocialShareProps, type ShareLink } from "./components/social-share";
export { SlideGallery, type SlideGalleryProps, type GalleryImage } from "./components/slide-gallery";
export { Sidebar, type SidebarProps } from "./components/sidebar";
// NavItem は lib/nav.js のもの(href 必須)を主とする。
// nav-dropdown のものは children を持つ別物なので、別名で出す。
export { NavDropdown, type NavDropdownProps, type NavItem as NavDropdownItem } from "./components/nav-dropdown";
export { Parallax, type ParallaxProps, Reveal, type RevealProps } from "./components/parallax";
export { easing, parallaxOffset, scrollProgress, revealStyle, transitionPresets, clamp01 } from "./lib/motion";
export { easingExtra, lerp, inverseLerp, mapRange, staggerDelays, stepSpring, isSpringSettled, type EasingName, type SpringState, type SpringConfig } from "./lib/motion-extra";
// Rect は lib/crop.js のもの(left/top/width/height)を主とする。
// motion-tween のものは x/y 基準の別物なので、別名で出す。
export { allEasings, applyEasing, tweenValue, parseHexColor, toHexColor, tweenColor, buildKeyframes, buildAnimationShorthand, flipTransform, type Keyframe, type Rect as TweenRect, type AnyEasingName } from "./lib/motion-tween";
export { BlockEditor, type BlockEditorProps, type EditableBlock } from "./components/block-editor";
export { SortableList, type SortableListProps, moveItem } from "./components/sortable-list";
