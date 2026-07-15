/**
 * `@platform/ui` — 共通 UI 部品(shadcn/ui + Radix ラッパー)。
 * デザイントークン(`tokens.css`)で配色・角丸・フォントを一元管理する。
 * @packageDocumentation
 */

// 基本・フォーム
export { Button, buttonVariants, type ButtonProps } from "./components/button.js";
export { SocialLoginButton, type SocialLoginButtonProps, type SocialProvider } from "./components/social-login-button.js";
export { SocialLoginGroup, type SocialLoginGroupProps, LoginDivider, type LoginDividerProps } from "./components/social-login-group.js";
export { LoginCard, type LoginCardProps } from "./components/login-card.js";
export { EmailLoginForm, type EmailLoginFormProps, type EmailLoginValues } from "./components/email-login-form.js";
export { validateEmailLogin, isEmailLike, isLoginFormValid, type LoginFormErrors } from "./lib/login-form.js";
export { PROVIDER_LABELS, socialLoginLabel, PROVIDER_AUTH_BACKEND } from "./lib/social-login.js";
export { Input, type InputProps } from "./components/input.js";
export { Textarea, type TextareaProps } from "./components/textarea.js";
export { PasswordInput, type PasswordInputProps } from "./components/password-input.js";
export { VoiceInput, type VoiceInputProps } from "./components/voice-input.js";
export { useSpeechRecognition, type SpeechRecognitionState, type UseSpeechRecognitionOptions } from "./components/use-speech-recognition.js";
export { PasswordStrengthMeter, type PasswordStrengthMeterProps } from "./components/password-strength-meter.js";
export { Select, type SelectProps, type SelectOption } from "./components/select.js";
export { Checkbox, type CheckboxProps } from "./components/checkbox.js";
export { Switch, type SwitchProps } from "./components/switch.js";
export { Slider, type SliderProps } from "./components/slider.js";

// 選択・トグル
export { RadioGroup, RadioGroupItem } from "./components/radio-group.js";
export { ToggleGroup, ToggleGroupItem } from "./components/toggle-group.js";
export { NumberInput, type NumberInputProps } from "./components/number-input.js";
export { DatePicker, TimePicker, DateTimePicker } from "./components/date-picker.js";
export { ColorPicker, type ColorPickerProps } from "./components/color-picker.js";
export { FileUpload, type FileUploadProps } from "./components/file-upload.js";
export { FileUploader, type FileUploaderProps } from "./components/file-uploader.js";
export { useUpload, type UseUploadOptions, type UploadResult } from "./components/use-upload.js";

// メニュー・選択
export { Combobox, type ComboboxProps, type ComboboxOption } from "./components/combobox.js";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./components/dropdown.js";

// オーバーレイ
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
  DialogClose,
} from "./components/dialog.js";
export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./components/tooltip.js";

// 表示
export { Carousel, type CarouselProps } from "./components/carousel.js";

// フィードバック・状態
export { Spinner, LoadingOverlay, type SpinnerProps } from "./components/spinner.js";
export { Progress, Seekbar, type SeekbarProps } from "./components/progress.js";
export { Steps, type StepsProps } from "./components/steps.js";
export { Toaster, toast } from "./components/toast.js";

// ダイアログ
export { Modal, type ModalProps } from "./components/modal.js";
export {
  ConfirmDialog, ErrorDialog,
  type ConfirmDialogProps, type ErrorDialogProps,
} from "./components/confirm-dialog.js";

// データ表示
export { DataTable, type DataTableProps, type Column } from "./components/data-table.js";

// 高度な入力
export { NumericKeypad, type NumericKeypadProps } from "./components/numpad.js";
export { SoftwareKeyboard, type SoftwareKeyboardProps } from "./components/software-keyboard.js";
export { RichTextEditor, type RichTextEditorProps } from "./components/rich-text-editor.js";

// ナビ・レイアウト・表示
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs.js";
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./components/accordion.js";
export { Avatar, AvatarImage, AvatarFallback } from "./components/avatar.js";
export { Badge, badgeVariants, type BadgeProps } from "./components/badge.js";
export { Skeleton } from "./components/skeleton.js";
export { Breadcrumb, type BreadcrumbProps, type BreadcrumbItem } from "./components/breadcrumb.js";
export { Pagination, SimplePagination, type PaginationProps, type SimplePaginationProps } from "./components/pagination.js";
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardGrid, type CardGridProps } from "./components/card.js";
export { List, ListItem, type ListItemProps } from "./components/list.js";
export { Block, BlockGrid, type BlockProps, type BlockGridProps } from "./components/block.js";
export { BackToTop, type BackToTopProps } from "./components/back-to-top.js";
export { DataView, ViewToggle, type DataViewProps, type ViewToggleProps, type ViewMode } from "./components/data-view.js";

// 高度な入力(評価・サジェスト・タグ・OTP・署名)
export { Rating, type RatingProps } from "./components/rating.js";
export { Autocomplete, type AutocompleteProps } from "./components/autocomplete.js";
export { TagInput, type TagInputProps } from "./components/tag-input.js";
export { OTPInput, type OTPInputProps } from "./components/otp-input.js";
export { SignaturePad, type SignaturePadProps } from "./components/signature-pad.js";

// メディアプレイヤー
export { VideoPlayer, type VideoPlayerProps } from "./components/video-player.js";
export { AudioPlayer, type AudioPlayerProps } from "./components/audio-player.js";
export { StreamPlayer, type StreamPlayerProps } from "./components/stream-player.js";
export { AudioRecorder, type AudioRecorderProps } from "./components/audio-recorder.js";
export { VideoRecorder, type VideoRecorderProps } from "./components/video-recorder.js";
export { AudioVisualizer, type AudioVisualizerProps } from "./components/audio-visualizer.js";
export { Waveform, type WaveformProps } from "./components/waveform.js";
export { formatTime } from "./lib/format-time.js";

// ユーティリティ
export { Icon, type IconProps, type IconName } from "./components/icon.js";
export { useClientInfo } from "./components/use-client-info.js";
export { useBluetooth, type UseBluetoothState } from "./components/use-bluetooth.js";
export { useHid, type UseHidState } from "./components/use-hid.js";
// グラフ(チャート)
export {
  BarChart, LineChart, ComboChart, PieChart, RadarChart, ScatterChart, GanttChart,
  Heatmap, Treemap, FunnelChart, ChartCard,
  CandlestickChart, BubbleChart, BandChart, Histogram, HorizontalBarChart,
  WaterfallChart, SankeyChart, Gauge, ProgressRing,
  SeriesToggle, useSeriesVisibility, toGanttRows, CHART_COLORS,
  type SeriesDef, type BaseChartProps, type CartesianChartProps, type PieChartProps,
  type RadarChartProps, type ScatterChartProps, type ScatterSeries, type GanttChartProps,
  type GanttTask, type GanttRow, type HeatmapProps, type TreemapProps, type FunnelChartProps, type ChartCardProps,
  type CandlestickChartProps, type Candlestick, type BubbleChartProps, type BubbleSeries, type BandChartProps, type HistogramProps,
  type WaterfallChartProps, type SankeyChartProps, type GaugeProps, type ProgressRingProps,
} from "./components/charts/index.js";
export { usePrint, type UsePrintResult } from "./components/use-print.js";
export { PrintButton, type PrintButtonProps } from "./components/print-button.js";
export { CsvExportButton, type CsvExportButtonProps } from "./components/csv-export-button.js";
export { elementToPng, type ExportPngOptions } from "./lib/export-image.js";
// 画像処理(ブラウザ Canvas)
export {
  loadImage, resizeImage, cropImage, pixelate, applyFilters, flipImage,
  convertFormat, removeBackgroundColor, maskImage, downloadBlob, type ImageFilters,
} from "./lib/image.js";
export { rectFromPoints, displayToNaturalRect, type Rect } from "./lib/crop.js";
export { ImageCropper, type ImageCropperProps } from "./components/image-cropper.js";
export { useImageUpload, type UseImageUploadOptions, type UseImageUploadResult } from "./components/use-image-upload.js";
export { FieldReview, type FieldReviewProps } from "./components/field-review.js";
export { classifyConfidence, bucketWords, countByTier, resolveThresholds, CONFIDENCE_PROFILES, type ConfidenceTier, type ConfidenceThresholds, type ConfidenceProfile } from "./lib/confidence.js";
export { ConfidenceHighlight, type ConfidenceHighlightProps, type ConfidenceToken } from "./components/confidence-highlight.js";
export { Highlight, type HighlightProps } from "./components/highlight.js";
export { LogViewer, type LogViewerProps } from "./components/log-viewer.js";
export { Sparkline, type SparklineProps } from "./components/sparkline.js";
export { Histogram, type HistogramProps } from "./components/histogram.js";
export { StatSummary, type StatSummaryProps } from "./components/stat-summary.js";
export { BoxPlot, type BoxPlotProps } from "./components/box-plot.js";
export { Trend, type TrendProps } from "./components/trend.js";
export { Gauge, type GaugeProps } from "./components/gauge.js";
export { KpiCard, type KpiCardProps } from "./components/kpi-card.js";
export { DonutChart, type DonutChartProps, type DonutDatum } from "./components/donut-chart.js";
export { BreakdownBar, type BreakdownBarProps, type BreakdownSegment } from "./components/breakdown-bar.js";
export { RankingList, type RankingListProps, type RankingItem } from "./components/ranking-list.js";
export { GoalProgress, type GoalProgressProps } from "./components/goal-progress.js";
export { Funnel, type FunnelProps, type FunnelStep } from "./components/funnel.js";
export { FreshnessIndicator, type FreshnessIndicatorProps } from "./components/freshness-indicator.js";
export { MetricGrid, type MetricGridProps } from "./components/metric-grid.js";
export { Scatter, type ScatterProps, type ScatterPoint } from "./components/scatter.js";
export { TimelineChart, type TimelineChartProps, type TimelineSeries, type TimelineBand } from "./components/timeline-chart.js";
export { createLogStream, type LogStream, type LogStreamOptions } from "./lib/log-stream.js";
export { useLogStream } from "./components/use-log-stream.js";
export { detectLogLevel, parseLogLines, filterLogLines, countByLevel, extractTimestamp, bucketByTime, logLinesToText, formatRelativeTime, parseStructuredLog, firstLineIndexAtOrAfter, collectFieldKeys, fieldFacets, filterByFields, appendCapped, LOG_LEVELS, type LogLevel, type LogLine, type LogFilter, type TimeBucket, type StructuredLog } from "./lib/log.js";
export { OcrFeedbackDashboard, type OcrFeedbackDashboardProps } from "./components/ocr-feedback-dashboard.js";
export { LocaleProvider, useI18n, useT, type LocaleProviderProps } from "./components/i18n-provider.js";
export { createLocalStorageLocaleStore, createFetchLocaleStore, isLocale, type LocaleStore } from "./lib/locale-store.js";
export { useLocalePreference } from "./components/use-locale.js";
export { collectCorrections, buildOcrFeedback, createOcrFeedbackStore, aggregateOcrFeedback, type FieldCorrection, type OcrFeedback, type OcrFeedbackStore, type FeedbackAggregate, type FieldFeedbackStat } from "./lib/ocr-feedback.js";
export { splitByConfidence, needsReview, type ReviewField } from "./lib/field-review.js";
export { DataTable, type DataTableProps, type DataTableColumn } from "./components/data-table.js";
export { queryRows, type TableQuery, type TableResult } from "./lib/table.js";
export { SheetGrid, type SheetGridProps, type SheetColumn } from "./components/sheet-grid.js";
export { normalizeCellRange, inRange, rangeToTsv, stickyLeftOffsets, applyColumnResize, computeVisibleRange, computeVisibleColumns, parseTsv, tsvToRows, type CellPos, type CellRange } from "./lib/grid.js";
export { validateImportRows, cellErrorLookup, errorRowIndices, filterErrorRows, summarizeImport, buildImportHistory, canRollback, canRollbackWith, validRows, partitionRows, type ImportField, type ImportValidation, type CellError, type FieldType, type ImportSummary, type ImportHistoryRow } from "./lib/import-validate.js";
export { ImportHistoryTable, type ImportHistoryTableProps } from "./components/import-history-table.js";
export { ImportHistoryDetail, type ImportHistoryDetailProps } from "./components/import-history-detail.js";
export { ImportReview, type ImportReviewProps } from "./components/import-review.js";
export { diffRecords, type RowDiff, type ChangedRow } from "./lib/diff.js";
export { DiffPreview, type DiffPreviewProps } from "./components/diff-preview.js";
export { applyColumnPrefs, toggleColumnHidden, moveColumn, emptyColumnPrefs, createColumnPrefsStore, type ColumnPrefs, type ColumnPrefsStore, type ColumnPrefsStoreOptions } from "./lib/column-prefs.js";
export { useColumnPrefs } from "./components/use-column-prefs.js";
export { ColumnSettings, type ColumnSettingsProps } from "./components/column-settings.js";
export { upsertPreset, removePreset, findPreset, splitPresets, defaultPreset, resolveInitialPrefs, createColumnPresetStore, type ColumnPreset, type ColumnPresetStore } from "./lib/column-presets.js";
export { ColumnPresets, type ColumnPresetsProps } from "./components/column-presets.js";
export { RecipientManager, type RecipientManagerProps } from "./components/recipient-manager.js";
export { upsertRecipient, removeRecipient, isValidEmail, validRecipients, recipientsToRows, recipientsFromRows, type Recipient } from "./lib/recipients.js";
export { DashboardGrid, DashboardWidget, StatCard, type DashboardGridProps, type DashboardWidgetProps, type StatCardProps } from "./components/dashboard.js";
export { DraggableDashboard, useDashboardLayout, type DraggableDashboardProps } from "./components/draggable-dashboard.js";
export { reorder, clampSpan, pxToColSpan, setColSpan, type LayoutItem, type DashboardLayout } from "./lib/layout.js";
export { createLocalStorageLayoutStore, createFetchLayoutStore, type LayoutStore, type FetchLayoutStoreOptions } from "./lib/layout-store.js";
export { appendCapped as appendItemCapped, appendManyCapped } from "./lib/live-buffer.js";
export { usePolling, useWebSocket, useLiveSeries, type UsePollingOptions, type WsStatus } from "./components/use-live.js";
export { useTween, useSpring, useInView, type UseTweenOptions, type UseInViewOptions } from "./components/use-animation.js";

export { cn } from "./lib/cn.js";
export { sparklineData, histogramData, movingAverageData, cumulativeData } from "./lib/chart-data.js";
export { computeShares, donutSegments, achievementRate, funnelStages, relativeTime, type Share, type DonutSegment, type FunnelStage } from "./lib/dashboard.js";
export { MiniCalendar, type MiniCalendarProps } from "./components/mini-calendar.js";
export { DateRangePicker, type DateRangePickerProps, type PickedRange } from "./components/date-range-picker.js";
export { CalendarHeatmap, type CalendarHeatmapProps } from "./components/calendar-heatmap.js";

// ── 追加コンポーネント(業務アプリ定番の欠け部品)──
export { Separator, type SeparatorProps } from "./components/separator.js";
export { Alert, type AlertProps } from "./components/alert.js";
export { ScrollArea, type ScrollAreaProps, useScrolledToBottom } from "./components/scroll-area.js";
export { TermsAcceptance, type TermsAcceptanceProps } from "./components/terms-acceptance.js";
export { EmptyState, type EmptyStateProps } from "./components/empty-state.js";
export { DescriptionList, type DescriptionListProps, type DescriptionItem } from "./components/description-list.js";
export { ActivityTimeline, type ActivityTimelineProps, type TimelineItem, type TimelineStatus } from "./components/activity-timeline.js";
export { Drawer, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, type DrawerContentProps, type DrawerSide } from "./components/drawer.js";

// ── 提案追加 + ダッシュボード部品 ──
export { Popover, PopoverTrigger, PopoverClose, PopoverAnchor, PopoverContent, type PopoverContentProps } from "./components/popover.js";
export { ButtonGroup, type ButtonGroupProps } from "./components/button-group.js";
export { SearchInput, type SearchInputProps } from "./components/search-input.js";
export { Tree, type TreeProps, type TreeNode } from "./components/tree.js";
export { toggleExpanded, collectAllIds, findNode, pathToNode } from "./lib/tree.js";
export { AppShell, SidebarNav, type AppShellProps, type SidebarNavProps, type SidebarNavItem } from "./components/app-shell.js";
export { AppHeader, type AppHeaderProps, HeaderNav, type HeaderNavProps } from "./components/app-header.js";
export { HamburgerButton, type HamburgerButtonProps } from "./components/hamburger-button.js";
export { NavMenu, type NavMenuProps } from "./components/nav-menu.js";
export { SiteFooter, type SiteFooterProps, type FooterLinkGroup } from "./components/site-footer.js";
export { UserMenu, type UserMenuProps, type UserMenuItem } from "./components/user-menu.js";
export { NotificationBell, type NotificationBellProps } from "./components/notification-bell.js";
export { CommandPalette, type CommandPaletteProps } from "./components/command-palette.js";
export { ContextMenu, type ContextMenuProps, type ContextMenuItem, useDisableContextMenu } from "./components/context-menu.js";
export { CopyButton, type CopyButtonProps, useCopyToClipboard, usePaste } from "./components/copy-button.js";
export { ErrorBoundary, type ErrorBoundaryProps } from "./components/error-boundary.js";
export { useKeyboardShortcuts, type ShortcutBinding } from "./components/use-keyboard-shortcuts.js";
export { parseShortcut, matchShortcut, formatShortcut, isSequence, parseSequence, sequenceMatches, type ParsedShortcut, type KeyChord } from "./lib/shortcut.js";
export { copyToClipboard, readClipboard } from "./lib/clipboard.js";
export { useNotifications, type UseNotificationsOptions, type UseNotificationsResult } from "./components/use-notifications.js";
export { filterCommands, groupCommands, scoreCommand, nextIndex, type Command } from "./lib/command.js";
export { notificationReducer, type NotificationAction, type NotificationReducerOptions } from "./lib/notification-store.js";
export { unreadCount, markRead, markAllRead, sortNotifications, groupByDate, type AppNotification, type NotificationKind } from "./lib/notifications.js";
export { PageHeader, type PageHeaderProps } from "./components/page-header.js";
export { ThemeToggle, type ThemeToggleProps } from "./components/theme-toggle.js";
export { ThemeProvider, useTheme, type ThemeProviderProps, type ThemeContextValue } from "./components/theme-provider.js";
export { SkinProvider, useSkin, SKIN_STORAGE_KEY, type SkinProviderProps, type SkinContextValue } from "./components/skin-provider.js";
export { SkinSelector, type SkinSelectorProps } from "./components/skin-selector.js";
export { AppSkin, type AppSkinProps } from "./components/app-skin.js";
export { ThemeSwitcher, type ThemeSwitcherProps } from "./components/theme-switcher.js";
export { EnvSettingsTable, type EnvSettingsTableProps, type EnvSettingRow } from "./components/env-settings-table.js";
export { resolveTheme, nextThemePreference, toggleTheme, applyTheme, THEME_LABELS, THEME_STORAGE_KEY, themeInitScript, type ThemePreference, type ResolvedTheme } from "./lib/theme.js";
export { isNavActive, findActiveNav, flattenNav, hasActiveChild, filterNavByPermission, type NavItem } from "./lib/nav.js";
export { NoticeBoard, type NoticeBoardProps, type NoticeItem, type NoticeLevel } from "./components/notice-board.js";
export { Kanban, type KanbanProps, type KanbanColumn, type KanbanCard } from "./components/kanban.js";
export { moveCard, countByColumn } from "./lib/kanban.js";

// ── スケジュール/カレンダー(閲覧用・Google カレンダー風)──
export { ScheduleCalendar, type ScheduleCalendarProps, type CalendarView } from "./components/schedule-calendar.js";
export {
  buildMonthGrid, eventsForDay, eventIntersectsDay, layoutDayEvents, groupEventsByDay, formatEventTime, formatHourLabel,
  type CalendarEvent, type PositionedEvent, type MonthCell,
} from "./lib/schedule.js";
export { CalendarLegend, type CalendarLegendProps, type CalendarCategory } from "./components/calendar-legend.js";
export {
  mergeIntervals, computeBusyIntervals, computeFreeSlots, findAvailableSlots, totalBusyMinutes, nowOffset,
  type TimeInterval,
} from "./lib/schedule.js";
export { EventDetailCard, type EventDetailCardProps } from "./components/event-detail-card.js";
export { ResourceSchedule, type ResourceScheduleProps } from "./components/resource-schedule.js";
export { eventsForResource, layoutResourceDay, type CalendarResource } from "./lib/schedule.js";
export { BlueprintActions, type BlueprintActionsProps, type BlueprintAction, type BlueprintStateStyle } from "./components/blueprint-actions.js";
export { MessageBubble, type MessageBubbleProps } from "./components/message-bubble.js";
export { MessageList, type MessageListProps, type DisplayMessage, type MessageGroup } from "./components/message-list.js";
export { MessageComposer, type MessageComposerProps } from "./components/message-composer.js";
export { ChatWindow, type ChatWindowProps } from "./components/chat-window.js";
export { PostCard, type PostCardProps, type ReactionCount } from "./components/post-card.js";
export { AttachmentList, type AttachmentListProps, type AttachmentItem } from "./components/attachment-list.js";
export { HighlightedText, type HighlightedTextProps } from "./components/highlighted-text.js";
export { highlightSegments, queryTerms, type HighlightSegment } from "./lib/highlight.js";
export { PinnedBanner, type PinnedBannerProps, type PinnedItem } from "./components/pinned-banner.js";
export { FileList, type FileListProps, type FileListItem } from "./components/file-list.js";
export { AuditLogView, type AuditLogViewProps, type AuditLogRow, type AuditVerification } from "./components/audit-log-view.js";
export { formatBytes } from "./lib/format-bytes.js";
export { StatCard, type StatCardProps } from "./components/stat-card.js";
export { NotificationPreferences, type NotificationPreferencesProps, type PreferenceValue, type PrefChannel, type PrefMode } from "./components/notification-preferences.js";
export { AuditEntryDetail, type AuditEntryDetailProps, type FieldChangeView } from "./components/audit-entry-detail.js";
export { DashboardSettings, type DashboardSettingsProps } from "./components/dashboard-settings.js";
export { BannerAd, type BannerAdProps } from "./components/banner-ad.js";
export { Eyecatch, type EyecatchProps } from "./components/eyecatch.js";
export { CtaButton, type CtaButtonProps } from "./components/cta-button.js";
export { CopyrightNotice, type CopyrightNoticeProps } from "./components/copyright-notice.js";
export { SocialShare, type SocialShareProps, type ShareLink } from "./components/social-share.js";
export { SlideGallery, type SlideGalleryProps, type GalleryImage } from "./components/slide-gallery.js";
export { Sidebar, type SidebarProps } from "./components/sidebar.js";
export { NavDropdown, type NavDropdownProps, type NavItem } from "./components/nav-dropdown.js";
export { Parallax, type ParallaxProps, Reveal, type RevealProps } from "./components/parallax.js";
export { easing, parallaxOffset, scrollProgress, revealStyle, transitionPresets, clamp01 } from "./lib/motion.js";
export { easingExtra, lerp, inverseLerp, mapRange, staggerDelays, stepSpring, isSpringSettled, type EasingName, type SpringState, type SpringConfig } from "./lib/motion-extra.js";
export { allEasings, applyEasing, tweenValue, parseHexColor, toHexColor, tweenColor, buildKeyframes, buildAnimationShorthand, flipTransform, type Keyframe, type Rect, type AnyEasingName } from "./lib/motion-tween.js";
export { BlockEditor, type BlockEditorProps, type EditableBlock } from "./components/block-editor.js";
export { SortableList, type SortableListProps, moveItem } from "./components/sortable-list.js";
