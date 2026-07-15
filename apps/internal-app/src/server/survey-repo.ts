/**
 * アンケート（社内調査）。設問（単一選択・複数選択・自由記述・評価）を持つアンケートを作成し、回答を集計する。
 * @packageDocumentation
 */

/** 設問の種類。 */
export type QuestionType = "single" | "multi" | "text" | "rating";

/** 設問。選択肢は single/multi のみ使用。 */
export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
}

/** アンケート。 */
/** 配信対象。departments/roles が両方空なら全員対象。 */
export interface Audience {
  departments: string[];
  roles: string[];
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  status: "draft" | "open" | "closed";
  /** 配信対象（部門・ロール）。 */
  audience: Audience;
  /** 匿名回答か（true なら回答者を記録しない）。 */
  anonymous: boolean;
  /** 回答締切（ISO、未設定なら無期限）。 */
  closesAt?: string;
  createdAt: string;
}

/** 1 設問への回答。choice=選択肢, text=自由記述, rating=1〜5。 */
export interface Answer {
  questionId: string;
  choice?: string[];
  text?: string;
  rating?: number;
}

/** アンケート回答。 */
export interface SurveyResponse {
  id: string;
  surveyId: string;
  /** 回答者（記名時のみ。匿名は undefined）。 */
  respondent?: string;
  answers: Answer[];
  submittedAt: string;
}

/** アンケート作成の入力。 */
export interface SurveyInput {
  title: string;
  description?: string;
  questions: { text: string; type: QuestionType; options?: string[] }[];
  audience?: Partial<Audience>;
  anonymous?: boolean;
  closesAt?: string;
}

// ── 対象判定・受付 ──

/** 配信対象を正規化（空配列補完）。 */
export function normalizeAudience(a?: Partial<Audience>): Audience {
  return { departments: a?.departments ?? [], roles: a?.roles ?? [] };
}

/** 利用者が配信対象か（対象が空なら全員該当）。 */
export function isEligible(user: { department: string; roles: string[] }, audience: Audience): boolean {
  if (audience.departments.length === 0 && audience.roles.length === 0) return true;
  if (audience.departments.includes(user.department)) return true;
  return user.roles.some((r) => audience.roles.includes(r));
}

/** 回答受付中か（公開中かつ締切前）。 */
export function isAcceptingResponses(survey: Survey, now: Date = new Date()): boolean {
  if (survey.status !== "open") return false;
  if (survey.closesAt && now.toISOString() >= survey.closesAt) return false;
  return true;
}

/** 配信対象となる有効利用者のメール一覧。 */
export function audienceRecipients(users: { email: string; department: string; roles: string[]; active: boolean }[], audience: Audience): string[] {
  return users.filter((u) => u.active && isEligible(u, audience)).map((u) => u.email);
}

/** 対象者のうち未回答の人（記名回答のみ判定可能。匿名回答は回答者不明のため除外できない）。 */
export function pendingRespondents(recipients: string[], responses: SurveyResponse[]): string[] {
  const responded = new Set(responses.map((r) => r.respondent).filter((e): e is string => e !== undefined));
  return recipients.filter((email) => !responded.has(email));
}

/** 締切が daysBefore 日以内に迫った公開中アンケート（リマインド対象・締切超過は除く）。 */
export function surveysDueForReminder(surveys: Survey[], now: Date, daysBefore: number): Survey[] {
  const horizon = now.getTime() + daysBefore * 24 * 60 * 60 * 1000;
  return surveys.filter((s) => {
    if (s.status !== "open" || !s.closesAt) return false;
    const close = new Date(s.closesAt).getTime();
    return close > now.getTime() && close <= horizon;
  });
}

// ── 集計 ──

/** 設問ごとの集計結果。 */
export interface QuestionResult {
  id: string;
  text: string;
  type: QuestionType;
  /** single/multi: 選択肢ごとの件数。 */
  options?: { label: string; count: number }[];
  /** rating: 平均（回答なしは 0）。 */
  average?: number;
  /** rating: 1〜5 の分布。 */
  distribution?: number[];
  /** text: 自由記述の一覧。 */
  texts?: string[];
  /** 回答者数（この設問に回答した数）。 */
  answered: number;
}

/** アンケート集計。 */
export interface SurveyResult {
  surveyId: string;
  total: number;
  questions: QuestionResult[];
}

/** アンケートと回答から集計を作る。 */
export function aggregateSurvey(survey: Survey, responses: SurveyResponse[]): SurveyResult {
  const answersFor = (qid: string): Answer[] => responses.map((r) => r.answers.find((a) => a.questionId === qid)).filter((a): a is Answer => a !== undefined);
  const questions: QuestionResult[] = survey.questions.map((q) => {
    const ans = answersFor(q.id);
    if (q.type === "single" || q.type === "multi") {
      const counts = new Map<string, number>((q.options ?? []).map((o) => [o, 0]));
      let answered = 0;
      for (const a of ans) {
        const chosen = a.choice ?? [];
        if (chosen.length > 0) answered += 1;
        for (const c of chosen) counts.set(c, (counts.get(c) ?? 0) + 1);
      }
      return { id: q.id, text: q.text, type: q.type, options: [...counts.entries()].map(([label, count]) => ({ label, count })), answered };
    }
    if (q.type === "rating") {
      const ratings = ans.map((a) => a.rating).filter((r): r is number => typeof r === "number" && r >= 1 && r <= 5);
      const distribution = [0, 0, 0, 0, 0];
      for (const r of ratings) distribution[r - 1] = (distribution[r - 1] ?? 0) + 1;
      const average = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0;
      return { id: q.id, text: q.text, type: q.type, average, distribution, answered: ratings.length };
    }
    const texts = ans.map((a) => (a.text ?? "").trim()).filter(Boolean);
    return { id: q.id, text: q.text, type: q.type, texts, answered: texts.length };
  });
  return { surveyId: survey.id, total: responses.length, questions };
}

const withQuestionIds = (questions: SurveyInput["questions"]): Question[] =>
  questions.map((q, i) => ({ id: `q${i + 1}`, text: q.text, type: q.type, ...(q.options ? { options: q.options } : {}) }));

// ── ストア ──

/** アンケートストア。 */
export interface SurveyStore {
  list(): Promise<Survey[]>;
  get(id: string): Promise<Survey | undefined>;
  create(input: SurveyInput): Promise<Survey>;
  setStatus(id: string, status: Survey["status"]): Promise<void>;
  respond(surveyId: string, answers: Answer[], respondent?: string): Promise<SurveyResponse>;
  responses(surveyId: string): Promise<SurveyResponse[]>;
}

let memSurvey = 0;
let memResp = 0;

/** インメモリ実装。 */
export function createMemorySurveyStore(): SurveyStore {
  const surveys: Survey[] = [];
  const responses: SurveyResponse[] = [];
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  return {
    async list() {
      return surveys.map(clone).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    async get(id) {
      const s = surveys.find((x) => x.id === id);
      return s ? clone(s) : undefined;
    },
    async create(input) {
      const survey: Survey = { id: `s${memSurvey++}`, title: input.title, description: input.description ?? "", questions: withQuestionIds(input.questions), status: "draft", audience: normalizeAudience(input.audience), anonymous: input.anonymous ?? false, ...(input.closesAt ? { closesAt: input.closesAt } : {}), createdAt: new Date().toISOString() };
      surveys.push(survey);
      return clone(survey);
    },
    async setStatus(id, status) {
      const s = surveys.find((x) => x.id === id);
      if (s) s.status = status;
    },
    async respond(surveyId, answers, respondent) {
      const resp: SurveyResponse = { id: `r${memResp++}`, surveyId, ...(respondent ? { respondent } : {}), answers, submittedAt: new Date().toISOString() };
      responses.push(resp);
      return clone(resp);
    },
    async responses(surveyId) {
      return responses.filter((r) => r.surveyId === surveyId).map(clone);
    },
  };
}

// ── Prisma 実装 ──

/** SurveyRow の必要部分（questions は JSON）。 */
export interface SurveyRow {
  id: string;
  title: string;
  description: string;
  questions: unknown;
  status: string;
  audience: unknown;
  anonymous: boolean;
  closesAt: string | null;
  createdAt: string;
}

/** SurveyResponseRow の必要部分（answers は JSON）。 */
export interface SurveyResponseRow {
  id: string;
  surveyId: string;
  respondent: string | null;
  answers: unknown;
  submittedAt: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface SurveyStoreDb {
  surveyRow: {
    findMany(args: { orderBy: { createdAt: "desc" } }): Promise<SurveyRow[]>;
    findUnique(args: { where: { id: string } }): Promise<SurveyRow | null>;
    create(args: { data: { title: string; description: string; questions: unknown; status: string; audience: unknown; anonymous: boolean; closesAt: string | null; createdAt: string } }): Promise<SurveyRow>;
    update(args: { where: { id: string }; data: { status: string } }): Promise<SurveyRow>;
  };
  surveyResponseRow: {
    findMany(args: { where: { surveyId: string } }): Promise<SurveyResponseRow[]>;
    create(args: { data: { surveyId: string; respondent: string | null; answers: unknown; submittedAt: string } }): Promise<SurveyResponseRow>;
  };
}

const rowToSurvey = (row: SurveyRow): Survey => ({ id: row.id, title: row.title, description: row.description, questions: Array.isArray(row.questions) ? (row.questions as Question[]) : [], status: row.status as Survey["status"], audience: normalizeAudience((row.audience ?? {}) as Partial<Audience>), anonymous: row.anonymous, ...(row.closesAt ? { closesAt: row.closesAt } : {}), createdAt: row.createdAt });
const rowToResponse = (row: SurveyResponseRow): SurveyResponse => ({ id: row.id, surveyId: row.surveyId, ...(row.respondent ? { respondent: row.respondent } : {}), answers: Array.isArray(row.answers) ? (row.answers as Answer[]) : [], submittedAt: row.submittedAt });

/** Prisma 実装。 */
export function createPrismaSurveyStore(db: SurveyStoreDb): SurveyStore {
  return {
    async list() {
      return (await db.surveyRow.findMany({ orderBy: { createdAt: "desc" } })).map(rowToSurvey);
    },
    async get(id) {
      const row = await db.surveyRow.findUnique({ where: { id } });
      return row ? rowToSurvey(row) : undefined;
    },
    async create(input) {
      const row = await db.surveyRow.create({ data: { title: input.title, description: input.description ?? "", questions: withQuestionIds(input.questions), status: "draft", audience: normalizeAudience(input.audience), anonymous: input.anonymous ?? false, closesAt: input.closesAt ?? null, createdAt: new Date().toISOString() } });
      return rowToSurvey(row);
    },
    async setStatus(id, status) {
      await db.surveyRow.update({ where: { id }, data: { status } });
    },
    async respond(surveyId, answers, respondent) {
      const row = await db.surveyResponseRow.create({ data: { surveyId, respondent: respondent ?? null, answers, submittedAt: new Date().toISOString() } });
      return rowToResponse(row);
    },
    async responses(surveyId) {
      return (await db.surveyResponseRow.findMany({ where: { surveyId } })).map(rowToResponse);
    },
  };
}
