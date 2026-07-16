/**
 * `@platform/zoho/projects` — Zoho Projects API クライアント。
 * ベースは `projectsapi.zoho.{dc}/restapi`。ポータル(portalId)配下のプロジェクト/タスク。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient } from "../core/client";
import { serviceBaseUrl, type ZohoDataCenter } from "../core/datacenter";

/** Projects レスポンス(緩め)。 */
export type ProjectsRecord = Record<string, unknown>;

/** Projects クライアント設定。 */
export interface ZohoProjectsConfig {
  dataCenter: ZohoDataCenter;
  accessToken: string;
  /** ポータル(組織)ID。 */
  portalId: string;
  fetchImpl?: typeof fetch;
}

/** Projects クライアント。 */
export interface ZohoProjectsClient {
  listPortals(): Promise<Result<ProjectsRecord>>;
  listProjects(params?: { index?: number; range?: number; status?: string }): Promise<Result<ProjectsRecord>>;
  getProject(projectId: string): Promise<Result<ProjectsRecord>>;
  createProject(project: Record<string, string>): Promise<Result<ProjectsRecord>>;
  listTasks(projectId: string, params?: { index?: number; range?: number; status?: string }): Promise<Result<ProjectsRecord>>;
  createTask(projectId: string, task: Record<string, string>): Promise<Result<ProjectsRecord>>;
  updateTask(projectId: string, taskId: string, fields: Record<string, string>): Promise<Result<ProjectsRecord>>;
  listMilestones(projectId: string): Promise<Result<ProjectsRecord>>;
  logTime(projectId: string, taskId: string, log: Record<string, string>): Promise<Result<ProjectsRecord>>;
}

/**
 * Zoho Projects(プロジェクト管理)のクライアントを作る。
 *
 * @param config.tokenManager トークンマネージャ(**自動更新される**)
 * @param config.dc データセンター(**契約時の DC を指定**。間違えると 404 になる)
 * @param config.fetchImpl fetch の実装(テスト注入用)
 * @returns Projects のクライアント。**すべてのメソッドは Result 型を返す**(例外を投げない)
 */
export function createZohoProjectsClient(config: ZohoProjectsConfig): ZohoProjectsClient {
  const api = createZohoApiClient({
    apiDomain: serviceBaseUrl("projects", config.dataCenter),
    basePath: "",
    accessToken: config.accessToken,
    fetchImpl: config.fetchImpl,
  });
  const enc = encodeURIComponent;
  const base = `/portal/${enc(config.portalId)}`;
  return {
    listPortals: () => api.get(`/portals/`),
    listProjects: (p) => api.get(`${base}/projects/`, { query: { index: p?.index, range: p?.range, status: p?.status } }),
    getProject: (id) => api.get(`${base}/projects/${enc(id)}/`),
    createProject: (project) => api.post(`${base}/projects/`, { query: project }),
    listTasks: (projectId, p) => api.get(`${base}/projects/${enc(projectId)}/tasks/`, { query: { index: p?.index, range: p?.range, status: p?.status } }),
    createTask: (projectId, task) => api.post(`${base}/projects/${enc(projectId)}/tasks/`, { query: task }),
    updateTask: (projectId, taskId, fields) => api.post(`${base}/projects/${enc(projectId)}/tasks/${enc(taskId)}/`, { query: fields }),
    listMilestones: (projectId) => api.get(`${base}/projects/${enc(projectId)}/milestones/`),
    logTime: (projectId, taskId, log) => api.post(`${base}/projects/${enc(projectId)}/tasks/${enc(taskId)}/logs/`, { query: log }),
  };
}
