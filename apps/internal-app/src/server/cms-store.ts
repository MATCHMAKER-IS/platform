/**
 * CMS ストア。ロジックは @platform/cms に集約し、ここでは再エクスポートするだけ。
 * （基盤=ロジック、アプリ=組み合わせ、の方針に沿ってドメインは共有パッケージへ）
 * @packageDocumentation
 */
export {
  isValidSlug,
  validatePostInput,
  isPublishAction,
  toPost,
  createMemoryCmsStore,
  createPrismaCmsStore,
  effectiveStatus,
  isLive,
  livePosts,
  scheduledPosts,
  type PostStatus,
  type EffectiveStatus,
  type CmsPost,
  type CmsPostInput,
  type CmsStore,
  type CmsStoreDb,
} from "@platform/cms";
