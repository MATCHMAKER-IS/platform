/**
 * Google Drive API クライアント。ファイル一覧・取得・アップロード(multipart)・ダウンロード・
 * フォルダ作成・共有権限の付与。OAuth アクセストークン(scope: drive / drive.file 等)で認証。
 * @packageDocumentation
 */
import { createApiClient, type MultipartFile } from "@platform/integrations";
import type { Result } from "@platform/core";

/** Drive クライアント。 */
export interface GoogleDriveClient {
  /** ファイル一覧(q は Drive 検索構文。例 "'FOLDER_ID' in parents")。 */
  listFiles(params?: { q?: string; pageSize?: number; pageToken?: string; fields?: string }): Promise<Result<{ files?: { id: string; name: string }[]; nextPageToken?: string }>>;
  /** ファイルのメタデータ取得。 */
  getFile(fileId: string, fields?: string): Promise<Result<unknown>>;
  /** ファイルをアップロードする(multipart: メタデータ + 本体)。作成したファイル情報を返す。 */
  uploadFile(params: { name: string; data: Uint8Array | Blob; mimeType?: string; parents?: string[] }): Promise<Result<{ id: string; name: string }>>;
  /** ファイル本体をダウンロードする(Response を返す)。 */
  downloadFile(fileId: string): Promise<Result<unknown>>;
  /** フォルダを作成する。 */
  createFolder(name: string, parentId?: string): Promise<Result<{ id: string }>>;
  /** ファイル/フォルダを共有する(権限付与)。 */
  shareFile(fileId: string, params: { role: "reader" | "writer" | "commenter" | "owner"; type: "user" | "group" | "domain" | "anyone"; emailAddress?: string; domain?: string }): Promise<Result<unknown>>;
  /** ファイルを削除する。 */
  deleteFile(fileId: string): Promise<Result<unknown>>;
}

/**
 * Google Drive クライアントを作る。
 * @param config `accessToken`(scope: drive 等)/ `fetchImpl`(認証付き fetch 注入可)
 */
export function createGoogleDriveClient(config: { accessToken: string; fetchImpl?: typeof fetch }): GoogleDriveClient {
  // メタデータ操作は /drive/v3、アップロードは /upload/drive/v3。ベースは共通ホスト。
  const api = createApiClient({
    baseUrl: "https://www.googleapis.com/drive/v3",
    headers: { Authorization: `Bearer ${config.accessToken}` },
    fetchImpl: config.fetchImpl,
  });
  const uploadApi = createApiClient({
    baseUrl: "https://www.googleapis.com/upload/drive/v3",
    headers: { Authorization: `Bearer ${config.accessToken}` },
    fetchImpl: config.fetchImpl,
  });
  return {
    listFiles: (params) => api.get<{ files?: { id: string; name: string }[]; nextPageToken?: string }>("/files", {
      query: { q: params?.q, pageSize: params?.pageSize, pageToken: params?.pageToken, fields: params?.fields ?? "files(id,name,mimeType),nextPageToken" },
    }),
    getFile: (fileId, fields) => api.get(`/files/${fileId}`, { query: { fields: fields ?? "id,name,mimeType,size,parents" } }),
    uploadFile: (params) => {
      const metadata = JSON.stringify({ name: params.name, ...(params.parents ? { parents: params.parents } : {}) });
      const metaFile: MultipartFile = { field: "metadata", filename: "metadata.json", data: new TextEncoder().encode(metadata), contentType: "application/json; charset=UTF-8" };
      const bodyFile: MultipartFile = { field: "file", filename: params.name, data: params.data, ...(params.mimeType ? { contentType: params.mimeType } : {}) };
      return uploadApi.post<{ id: string; name: string }>("/files", { query: { uploadType: "multipart", fields: "id,name" }, multipart: { files: [metaFile, bodyFile] } });
    },
    downloadFile: (fileId) => api.get(`/files/${fileId}`, { query: { alt: "media" } }),
    createFolder: (name, parentId) => api.post<{ id: string }>("/files", { body: { name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) } }),
    shareFile: (fileId, params) => api.post(`/files/${fileId}/permissions`, {
      body: { role: params.role, type: params.type, ...(params.emailAddress ? { emailAddress: params.emailAddress } : {}), ...(params.domain ? { domain: params.domain } : {}) },
    }),
    deleteFile: (fileId) => api.delete(`/files/${fileId}`),
  };
}
