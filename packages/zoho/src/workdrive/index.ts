/**
 * `@platform/zoho/workdrive` — Zoho WorkDrive API(v1)クライアント。
 * ベースは `workdrive.zoho.{dc}/api/v1`。JSON:API 準拠(data.type/attributes)。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient } from "../core/client.js";
import { serviceBaseUrl, type ZohoDataCenter } from "../core/datacenter.js";

/** WorkDrive リソース(緩め)。 */
export type WorkDriveRecord = Record<string, unknown>;

/** WorkDrive クライアント設定。 */
export interface ZohoWorkDriveConfig { dataCenter: ZohoDataCenter; accessToken: string; fetchImpl?: typeof fetch }

/** WorkDrive クライアント。 */
export interface ZohoWorkDriveClient {
  /** 現在のユーザー。 */
  getCurrentUser(): Promise<Result<WorkDriveRecord>>;
  /** チームのワークスペース一覧。 */
  listWorkspaces(teamId: string): Promise<Result<WorkDriveRecord>>;
  /** ファイル/フォルダのメタ情報。 */
  getFile(fileId: string): Promise<Result<WorkDriveRecord>>;
  /** フォルダ内の一覧。 */
  listFolderContents(folderId: string): Promise<Result<WorkDriveRecord>>;
  /** フォルダ作成(JSON:API)。 */
  createFolder(parentId: string, name: string): Promise<Result<WorkDriveRecord>>;
  /** ファイル/フォルダのリネーム。 */
  renameFile(fileId: string, name: string): Promise<Result<WorkDriveRecord>>;
  /** ゴミ箱へ移動。 */
  trashFile(fileId: string): Promise<Result<WorkDriveRecord>>;
  /** ファイルをアップロードする(multipart)。 */
  uploadFile(parentId: string, filename: string, content: Uint8Array | Blob, contentType?: string): Promise<Result<WorkDriveRecord>>;
}

/**
 * Zoho WorkDrive(ファイル共有)のクライアントを作る。
 *
 * @param config.tokenManager トークンマネージャ(**自動更新される**)
 * @param config.dc データセンター(**契約時の DC を指定**。間違えると 404 になる)
 * @param config.fetchImpl fetch の実装(テスト注入用)
 * @returns WorkDrive のクライアント。**すべてのメソッドは Result 型を返す**(例外を投げない)
 */
export function createZohoWorkDriveClient(config: ZohoWorkDriveConfig): ZohoWorkDriveClient {
  const api = createZohoApiClient({ apiDomain: serviceBaseUrl("workdrive", config.dataCenter), basePath: "", accessToken: config.accessToken, fetchImpl: config.fetchImpl });
  const enc = encodeURIComponent;
  return {
    getCurrentUser: () => api.get(`/users/me`),
    listWorkspaces: (teamId) => api.get(`/teams/${enc(teamId)}/workspaces`),
    getFile: (fileId) => api.get(`/files/${enc(fileId)}`),
    listFolderContents: (folderId) => api.get(`/files/${enc(folderId)}/files`),
    createFolder: (parentId, name) => api.post(`/files`, { body: { data: { attributes: { name, parent_id: parentId, resource_type: "folder" }, type: "files" } } }),
    renameFile: (fileId, name) => api.patch(`/files/${enc(fileId)}`, { body: { data: { attributes: { name }, type: "files" } } }),
    trashFile: (fileId) => api.patch(`/files/${enc(fileId)}`, { body: { data: { attributes: { status: "51" }, type: "files" } } }),
    uploadFile: (parentId, filename, content, contentType) =>
      api.post(`/upload`, { query: { filename, parent_id: parentId, override_name_exist: "true" }, multipart: { files: [{ field: "content", filename, data: content, contentType }] } }),
  };
}
