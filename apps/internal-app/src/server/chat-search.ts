/**
 * チャット/掲示板の全文検索。@platform/search(BM25)にメッセージ・投稿を索引し、検索する。
 * ロジック(トークン化・スコアリング)は @platform/search、ここは索引の出し入れとフィルタを担う。
 * @packageDocumentation
 */
import { type ChatMessage } from "@platform/chat";
import { type Post } from "@platform/board";
import { type Search, type SearchDocument, type SearchHit } from "@platform/search";

/** メッセージの索引ドキュメント。 */
export interface MessageDoc extends SearchDocument {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  at: string;
}

/** 投稿の索引ドキュメント。 */
export interface PostDoc extends SearchDocument {
  id: string;
  threadId: string;
  authorId: string;
  body: string;
  at: string;
}

/** 検索結果(メッセージ)。 */
export interface MessageSearchResult {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  at: string;
  score?: number;
}

/** 検索結果(投稿)。 */
export interface PostSearchResult {
  id: string;
  threadId: string;
  authorId: string;
  body: string;
  at: string;
  score?: number;
}

/** チャット/掲示板の検索。 */
export interface ChatSearch {
  indexMessage(message: ChatMessage): Promise<void>;
  removeMessage(id: string): Promise<void>;
  searchMessages(query: string, options?: { roomId?: string; limit?: number }): Promise<MessageSearchResult[]>;
  indexPost(post: Post, threadId: string): Promise<void>;
  removePost(id: string): Promise<void>;
  searchPosts(query: string, options?: { threadId?: string; limit?: number }): Promise<PostSearchResult[]>;
}

function messageToDoc(m: ChatMessage): MessageDoc {
  return { id: m.id, roomId: m.roomId, senderId: m.senderId, text: m.text, at: m.at };
}
function postToDoc(p: Post, threadId: string): PostDoc {
  return { id: p.id, threadId, authorId: p.authorId, body: p.body, at: p.createdAt };
}

/** メッセージ検索と投稿検索(それぞれ別の索引)を束ねる。 */
export function createChatSearch(deps: { messageSearch: Search<MessageDoc>; postSearch: Search<PostDoc> }): ChatSearch {
  const { messageSearch, postSearch } = deps;
  return {
    async indexMessage(message) {
      await messageSearch.index([messageToDoc(message)]);
    },
    async removeMessage(id) {
      await messageSearch.delete([id]);
    },
    async searchMessages(query, options = {}) {
      const res = await messageSearch.search(query, options.limit ?? 20);
      const hits: SearchHit<MessageDoc>[] = res.ok ? res.value : [];
      return hits
        .filter((h) => !options.roomId || h.document.roomId === options.roomId)
        .map((h) => ({ id: h.document.id, roomId: h.document.roomId, senderId: h.document.senderId, text: h.document.text, at: h.document.at, ...(h.score !== undefined ? { score: h.score } : {}) }));
    },
    async indexPost(post, threadId) {
      await postSearch.index([postToDoc(post, threadId)]);
    },
    async removePost(id) {
      await postSearch.delete([id]);
    },
    async searchPosts(query, options = {}) {
      const res = await postSearch.search(query, options.limit ?? 20);
      const hits: SearchHit<PostDoc>[] = res.ok ? res.value : [];
      return hits
        .filter((h) => !options.threadId || h.document.threadId === options.threadId)
        .map((h) => ({ id: h.document.id, threadId: h.document.threadId, authorId: h.document.authorId, body: h.document.body, at: h.document.at, ...(h.score !== undefined ? { score: h.score } : {}) }));
    },
  };
}
