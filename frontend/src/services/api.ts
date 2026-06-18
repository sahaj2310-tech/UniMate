const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const ADMIN_TOKEN_KEY = "unimate_admin_token";

export type ApiCitation = {
  title: string;
  url: string;
  last_updated?: string | null;
};

export type ChatResponse = {
  answer: string;
  confidence: "high" | "medium" | "low" | string;
  citations: ApiCitation[];
  related_pages: ApiCitation[];
  suggested_next_actions: string[];
  requires_handoff: boolean;
  routed_office?: string | null;
  language: string;
};

export type SourceDocument = {
  id?: number;
  url: string;
  title: string;
  source_type: string;
  language: string;
  raw_hash?: string;
  raw_text?: string;
  status?: "pending" | "approved" | "rejected" | string;
  last_crawled_at?: string;
  published_at?: string | null;
};

export type SourceDocumentInput = {
  url: string;
  title: string;
  source_type?: string;
  language?: string;
  raw_text: string;
  published_at?: string | null;
};

export type AdminAnalytics = {
  total_queries: number;
  verified_answers: number;
  escalated_to_human: number;
  failed_queries: number;
  average_response_time: string;
  language_usage: Record<string, number>;
};

export type FailedQuery = {
  id: number;
  query: string;
  language: string;
  topic: string;
  routed_office?: string | null;
  created_at: string;
};

export type AdminUser = {
  email: string;
  role: "admin" | "reviewer" | string;
  is_active: boolean;
};

export type AdminTokenResponse = {
  access_token: string;
  token_type: string;
  role: string;
};

export type BulkApprovalResponse = {
  status: string;
  requested_count: number;
  approved_count: number;
  already_approved_count: number;
  not_found_count: number;
  chunks_activated_count: number;
  approved_document_ids: number[];
  already_approved_document_ids: number[];
  not_found_document_ids: number[];
};

export type CrawlJob = {
  id?: number;
  seed_url: string;
  status: string;
  page_limit: number;
  created_at: string;
  finished_at?: string | null;
};

export type CrawlLog = {
  id?: number;
  job_id?: number | null;
  url: string;
  status_code?: number | null;
  message: string;
  created_at: string;
};

export type Notice = {
  id?: number;
  title: string;
  category: string;
  date: string;
  description: string;
  source_url?: string | null;
};

export type OfficeContact = {
  id?: number;
  name: string;
  purpose: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  source_url?: string | null;
};

export type LanguageOption = {
  code: string;
  nativeName?: string;
  native_name?: string;
  englishName?: string;
  english_name?: string;
  enabled?: boolean;
};

export type FeedbackRequest = {
  message_id?: number | null;
  helpful: boolean;
  reasons?: string[];
  comment?: string | null;
};

export type HandoffTicket = {
  id?: number;
  user_email?: string | null;
  question: string;
  language: string;
  office_name: string;
  status: string;
  created_at: string;
};

export type NoticeExplainerResponse = {
  summary: string;
  action_required: string[];
  language: string;
};

export type ChecklistResponse = {
  title: string;
  items: string[];
};

type RequestOptions = RequestInit & {
  auth?: boolean;
};

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `API request failed: ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function getAdminToken() {
  if (typeof window !== "undefined") {
    const storedToken = window.localStorage.getItem(ADMIN_TOKEN_KEY);
    if (storedToken) return storedToken;
  }
  return import.meta.env.VITE_ADMIN_TOKEN;
}

function hasStoredAdminToken() {
  if (typeof window === "undefined") return Boolean(import.meta.env.VITE_ADMIN_TOKEN);
  return Boolean(window.localStorage.getItem(ADMIN_TOKEN_KEY) || import.meta.env.VITE_ADMIN_TOKEN);
}

function authHeaders(enabled?: boolean): HeadersInit {
  const token = enabled ? getAdminToken() : undefined;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(init?.auth),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    let detail: unknown = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? body.message ?? detail;
    } catch {
      // Keep the status text when the backend returns a non-JSON error.
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  hasAdminToken: hasStoredAdminToken,
  setAdminToken: (token: string) => {
    window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  },
  clearAdminToken: () => {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  },
  health: () => request<{ status: string; service: string }>("/api/health"),
  chat: (message: string, language: string | null = "en") =>
    request<ChatResponse>("/api/chat", { method: "POST", body: JSON.stringify({ message, language }) }),
  feedback: (body: FeedbackRequest) => request<{ status: string }>("/api/feedback", { method: "POST", body: JSON.stringify(body) }),
  reportAnswer: (body: FeedbackRequest) => request<{ status: string }>("/api/report-answer", { method: "POST", body: JSON.stringify(body) }),
  sources: () => request<SourceDocument[]>("/api/sources"),
  notices: () => request<Notice[]>("/api/notices"),
  offices: () => request<OfficeContact[]>("/api/offices"),
  languages: () => request<LanguageOption[]>("/api/languages"),
  handoffTicket: (body: { question: string; language?: string; user_email?: string | null; office_name?: string | null }) =>
    request<HandoffTicket>("/api/handoff-ticket", { method: "POST", body: JSON.stringify({ language: "en", ...body }) }),
  explainNotice: (content: string, language = "en") =>
    request<NoticeExplainerResponse>("/api/notice-explainer", { method: "POST", body: JSON.stringify({ content, language }) }),
  checklist: (audience = "new_student", language = "en") =>
    request<ChecklistResponse>("/api/checklist", { method: "POST", body: JSON.stringify({ audience, language }) }),
  admin: {
    login: (email: string, password: string) =>
      request<AdminTokenResponse>("/api/admin/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    me: () => request<AdminUser>("/api/admin/me", { auth: true }),
    analytics: () => request<AdminAnalytics>("/api/admin/analytics", { auth: true }),
    sources: () => request<SourceDocument[]>("/api/admin/sources", { auth: true }),
    failedQueries: () => request<FailedQuery[]>("/api/admin/failed-queries", { auth: true }),
    crawlLogs: () => request<CrawlLog[]>("/api/admin/crawl-logs", { auth: true }),
    startCrawl: (seed_url: string, page_limit = 40) =>
      request<CrawlJob>("/api/admin/crawl", { method: "POST", auth: true, body: JSON.stringify({ seed_url, page_limit }) }),
    createSource: (document: SourceDocumentInput) =>
      request<SourceDocument>("/api/admin/sources", { method: "POST", auth: true, body: JSON.stringify(document) }),
    approveDocuments: (documentIds: number[], notes?: string) =>
      request<BulkApprovalResponse>("/api/admin/approve-documents", { method: "POST", auth: true, body: JSON.stringify({ document_ids: documentIds, notes }) }),
    approveDocument: (documentId: number) =>
      request<{ status: string; document_id: number }>(`/api/admin/approve-document?document_id=${documentId}`, { method: "POST", auth: true }),
    rejectDocument: (documentId: number) =>
      request<{ status: string; document_id: number }>(`/api/admin/reject-document?document_id=${documentId}`, { method: "POST", auth: true })
  }
};
