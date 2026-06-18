import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Panel } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { ApiError, api } from "@/services/api";
import type { AdminAnalytics, AdminUser, CrawlJob, CrawlLog, FailedQuery, SourceDocument } from "@/services/api";
import { adminMetrics } from "../productData";

type AuthState = "checking" | "authorized" | "unauthorized";

const AdminCharts = lazy(() => import("./AdminCharts"));

function statusPill(status: string) {
  return status === "approved"
    ? "bg-green-50 text-trust"
    : status === "rejected"
      ? "bg-red-50 text-red-700"
      : "bg-amber-50 text-amber-700";
}

export default function AdminDashboard() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [failedQueries, setFailedQueries] = useState<FailedQuery[]>([]);
  const [crawlLogs, setCrawlLogs] = useState<CrawlLog[]>([]);
  const [lastCrawlJob, setLastCrawlJob] = useState<CrawlJob | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [crawlUrl, setCrawlUrl] = useState("https://www.unimate.example.edu/main/index.jsp");
  const [crawlLimit, setCrawlLimit] = useState(20);
  const [sourceForm, setSourceForm] = useState({
    title: "",
    url: "",
    language: "en",
    source_type: "web",
    raw_text: ""
  });

  const sourceCounts = useMemo(() => {
    return sources.reduce(
      (counts, source) => {
        const status = source.status && source.status in counts ? source.status : "pending";
        counts[status as "pending" | "approved" | "rejected"] += 1;
        return counts;
      },
      { pending: 0, approved: 0, rejected: 0 }
    );
  }, [sources]);

  const liveMetrics = analytics
    ? [
        ["Total Queries", analytics.total_queries.toLocaleString(), "Live"],
        ["Verified Answers", analytics.verified_answers.toLocaleString(), "Live"],
        ["Escalated", analytics.escalated_to_human.toLocaleString(), "Live"],
        ["Failed Queries", analytics.failed_queries.toLocaleString(), "Live"],
        ["Avg. Response", analytics.average_response_time, "Live"]
      ]
    : adminMetrics;
  const countCards: Array<{ label: string; value: number; className: string; Icon: LucideIcon }> = [
    { label: "Pending", value: sourceCounts.pending, className: "bg-amber-50 text-amber-700", Icon: AlertTriangle },
    { label: "Approved", value: sourceCounts.approved, className: "bg-green-50 text-trust", Icon: CheckCircle2 },
    { label: "Rejected", value: sourceCounts.rejected, className: "bg-red-50 text-red-700", Icon: XCircle }
  ];

  async function validateSession() {
    setLoginError("");
    if (!api.hasAdminToken()) {
      setAuthState("unauthorized");
      setIsLoading(false);
      return;
    }
    try {
      const user = await api.admin.me();
      setAdminUser(user);
      setAuthState("authorized");
      await loadDashboard();
    } catch (err) {
      api.clearAdminToken();
      setAuthState("unauthorized");
      setIsLoading(false);
      setLoginError(err instanceof ApiError && err.status === 401 ? "Your admin session has expired. Please sign in again." : "Unable to validate admin session.");
    }
  }

  async function loadDashboard() {
    setIsLoading(true);
    setError("");
    try {
      const [sourceRows, adminStats, failedRows, logRows] = await Promise.all([
        api.admin.sources(),
        api.admin.analytics(),
        api.admin.failedQueries(),
        api.admin.crawlLogs()
      ]);
      setSources(sourceRows);
      setAnalytics(adminStats);
      setFailedQueries(failedRows);
      setCrawlLogs(logRows);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        api.clearAdminToken();
        setAuthState("unauthorized");
        setLoginError("Admin authorization is required.");
      } else {
        setError(err instanceof Error ? err.message : "Unable to load admin dashboard data.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void validateSession();
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setIsMutating(true);
    try {
      const response = await api.admin.login(loginEmail, loginPassword);
      api.setAdminToken(response.access_token);
      setAuthState("authorized");
      await validateSession();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setIsMutating(false);
    }
  }

  function logout() {
    api.clearAdminToken();
    setAdminUser(null);
    setAuthState("unauthorized");
    setSources([]);
    setSelectedIds([]);
  }

  function toggleSource(sourceId?: number) {
    if (!sourceId) return;
    setSelectedIds((current) => current.includes(sourceId) ? current.filter((id) => id !== sourceId) : [...current, sourceId]);
  }

  async function bulkReview(action: "approve" | "reject") {
    if (!selectedIds.length) return;
    setIsMutating(true);
    setError("");
    setNotice("");
    try {
      if (action === "approve") {
        const response = await api.admin.approveDocuments(selectedIds, "Approved from admin dashboard");
        setNotice(`Approved ${response.approved_count} documents. ${response.already_approved_count} were already approved.`);
      } else {
        await Promise.all(selectedIds.map((id) => api.admin.rejectDocument(id)));
        setNotice(`Rejected ${selectedIds.length} documents.`);
      }
      setSources((current) => current.map((source) => source.id && selectedIds.includes(source.id) ? { ...source, status: action === "approve" ? "approved" : "rejected" } : source));
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk review failed.");
    } finally {
      setIsMutating(false);
    }
  }

  async function startCrawl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsMutating(true);
    setError("");
    setNotice("");
    try {
      const job = await api.admin.startCrawl(crawlUrl, crawlLimit);
      setLastCrawlJob(job);
      setNotice(`Crawl job ${job.id ?? ""} started for ${job.seed_url}.`);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start crawl.");
    } finally {
      setIsMutating(false);
    }
  }

  async function createSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsMutating(true);
    setError("");
    setNotice("");
    try {
      const created = await api.admin.createSource({
        ...sourceForm
      });
      setSources((current) => [created, ...current]);
      setSourceForm({ title: "", url: "", language: "en", source_type: "web", raw_text: "" });
      setNotice("Source added to the approval queue.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create source.");
    } finally {
      setIsMutating(false);
    }
  }

  if (authState === "checking") {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-100 p-4">
        <Panel className="w-full max-w-sm text-center">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-brand-600" />
          <p className="mt-3 text-sm font-semibold text-slate-600">Validating admin session...</p>
        </Panel>
      </main>
    );
  }

  if (authState === "unauthorized") {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-100 p-4">
        <Panel className="w-full max-w-md">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <ShieldAlert className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold text-slate-950">Admin authorization required</h1>
              <p className="text-sm text-slate-500">Sign in to review sources, crawl logs, and failed questions.</p>
            </div>
          </div>
          {loginError ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{loginError}</p> : null}
          <form onSubmit={login} className="mt-5 space-y-3">
            <label className="block text-sm font-bold text-slate-700" htmlFor="admin-email">Email</label>
            <Input id="admin-email" type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} autoComplete="username" required />
            <label className="block text-sm font-bold text-slate-700" htmlFor="admin-password">Password</label>
            <Input id="admin-password" type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} autoComplete="current-password" required />
            <Button type="submit" className="w-full" disabled={isMutating}>{isMutating ? "Signing in..." : "Sign In"}</Button>
          </form>
        </Panel>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-100 p-4">
      <div className="mx-auto grid max-w-7xl overflow-hidden rounded-2xl bg-white shadow-soft lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="bg-brand-900 p-5 text-white">
          <div className="flex items-center gap-3">
            <Bot className="h-8 w-8" />
            <div>
              <p className="font-extrabold">UniMate Admin</p>
              <p className="text-xs text-blue-200">{adminUser?.email ?? "UNIMATE AI Assistant"}</p>
            </div>
          </div>
          <nav className="mt-6 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
            {["Dashboard", "Sources", "Failed Questions", "Crawl Logs", "Create Source", "Settings"].map((item, index) => (
              <a key={item} className={cn("flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-semibold", index === 0 ? "bg-white text-brand-900" : "text-blue-100 hover:bg-white/10")} href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}>
                <LayoutDashboard className="h-4 w-4" />
                {item}
              </a>
            ))}
          </nav>
        </aside>
        <section className="min-w-0 p-4 sm:p-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-950">Dashboard</h1>
              <p className="text-sm text-slate-500">Live review of verified answers, gaps, and student support routing.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void loadDashboard()} disabled={isLoading}><RefreshCw className="h-4 w-4" />Refresh</Button>
              <Button variant="ghost" onClick={logout}><LogOut className="h-4 w-4" />Logout</Button>
            </div>
          </header>
          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}
          {notice ? <p className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-trust">{notice}</p> : null}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {liveMetrics.map(([label, value, delta]) => (
              <Panel key={label}>
                <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-extrabold text-slate-950">{value}</p>
                <p className={cn("mt-1 text-xs font-bold", delta.startsWith("-") ? "text-trust" : "text-brand-600")}>{delta}</p>
              </Panel>
            ))}
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
            <Suspense fallback={<Panel className="h-72 xl:col-span-2"><p className="text-sm font-semibold text-slate-500">Loading analytics charts...</p></Panel>}>
              <AdminCharts />
            </Suspense>
          </div>
          <div id="sources" className="mt-6 grid gap-4 lg:grid-cols-3">
            <Panel>
              <h2 className="font-bold text-slate-900">Source Counts</h2>
              <div className="mt-3 grid gap-2">
                {countCards.map(({ label, value, className, Icon }) => (
                  <div key={label} className={cn("flex items-center justify-between rounded-lg p-3 text-sm font-bold", className)}>
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {label}
                    </span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel className="lg:col-span-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-bold text-slate-900">Full Source List</h2>
                  <p className="text-xs font-semibold text-slate-500">{selectedIds.length} selected from {sources.length} documents</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => void bulkReview("approve")} disabled={!selectedIds.length || isMutating}>Approve</Button>
                  <Button variant="danger" onClick={() => void bulkReview("reject")} disabled={!selectedIds.length || isMutating}>Reject</Button>
                </div>
              </div>
              <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
                {isLoading ? (
                  <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-500">Loading sources...</p>
                ) : sources.length ? sources.map((source) => (
                  <label key={source.id ?? source.url} className="flex cursor-pointer items-start gap-3 rounded-lg bg-slate-50 p-3">
                    <input
                      type="checkbox"
                      checked={Boolean(source.id && selectedIds.includes(source.id))}
                      disabled={!source.id || isMutating}
                      onChange={() => toggleSource(source.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-800">{source.title}</span>
                      <span className="block truncate text-xs text-slate-500">{source.url}</span>
                      <span className="mt-1 block text-xs text-slate-400">{source.language} · {source.source_type} · crawled {source.last_crawled_at ? new Date(source.last_crawled_at).toLocaleDateString() : "unknown"}</span>
                    </span>
                    <span className={cn("rounded-full px-2 py-1 text-xs font-bold", statusPill(source.status ?? "pending"))}>{source.status ?? "pending"}</span>
                  </label>
                )) : (
                  <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-500">No source documents found.</p>
                )}
              </div>
            </Panel>
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <Panel id="failed-questions">
              <h2 className="flex items-center gap-2 font-bold text-slate-900"><Search className="h-4 w-4 text-brand-600" />Failed Queries</h2>
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                {failedQueries.length ? failedQueries.map((query) => (
                  <div key={query.id} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-sm font-bold text-slate-800">{query.query}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{query.language} · {query.topic} · {query.routed_office ?? "No office routed"}</p>
                  </div>
                )) : <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-500">No failed queries yet.</p>}
              </div>
            </Panel>
            <Panel id="crawl-logs">
              <h2 className="flex items-center gap-2 font-bold text-slate-900"><Database className="h-4 w-4 text-brand-600" />Crawl Logs</h2>
              <form onSubmit={startCrawl} className="mt-3 grid gap-2 sm:grid-cols-[1fr_96px_auto]">
                <label className="sr-only" htmlFor="crawl-url">Seed URL</label>
                <Input id="crawl-url" value={crawlUrl} onChange={(event) => setCrawlUrl(event.target.value)} required />
                <label className="sr-only" htmlFor="crawl-limit">Page limit</label>
                <Input id="crawl-limit" type="number" min={1} max={200} value={crawlLimit} onChange={(event) => setCrawlLimit(Number(event.target.value))} required />
                <Button type="submit" disabled={isMutating}>Start</Button>
              </form>
              {lastCrawlJob ? <p className="mt-2 text-xs font-semibold text-slate-500">Latest job: {lastCrawlJob.status} · {lastCrawlJob.page_limit} pages</p> : null}
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {crawlLogs.length ? crawlLogs.map((log) => (
                  <div key={log.id ?? `${log.url}-${log.created_at}`} className="rounded-lg bg-slate-50 p-3">
                    <p className="truncate text-sm font-bold text-slate-800">{log.url}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{log.status_code ?? "n/a"} · {log.message}</p>
                  </div>
                )) : <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-500">No crawl logs available.</p>}
              </div>
            </Panel>
          </div>
          <Panel id="create-source" className="mt-6">
            <h2 className="flex items-center gap-2 font-bold text-slate-900"><FilePlus2 className="h-4 w-4 text-brand-600" />Create Source</h2>
            <form onSubmit={createSource} className="mt-3 grid gap-3 lg:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700" htmlFor="source-title">Title</label>
              <Input id="source-title" value={sourceForm.title} onChange={(event) => setSourceForm((current) => ({ ...current, title: event.target.value }))} required />
              <label className="block text-sm font-bold text-slate-700" htmlFor="source-url">URL</label>
              <Input id="source-url" type="url" value={sourceForm.url} onChange={(event) => setSourceForm((current) => ({ ...current, url: event.target.value }))} required />
              <label className="block text-sm font-bold text-slate-700" htmlFor="source-language">Language</label>
              <Input id="source-language" value={sourceForm.language} onChange={(event) => setSourceForm((current) => ({ ...current, language: event.target.value }))} required />
              <label className="block text-sm font-bold text-slate-700" htmlFor="source-type">Source type</label>
              <Input id="source-type" value={sourceForm.source_type} onChange={(event) => setSourceForm((current) => ({ ...current, source_type: event.target.value }))} required />
              <label className="block text-sm font-bold text-slate-700 lg:col-span-2" htmlFor="source-text">Source text</label>
              <textarea
                id="source-text"
                value={sourceForm.raw_text}
                onChange={(event) => setSourceForm((current) => ({ ...current, raw_text: event.target.value }))}
                className="min-h-32 rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 lg:col-span-2"
                required
              />
              <Button type="submit" className="lg:col-span-2" disabled={isMutating}>Add Source for Review</Button>
            </form>
          </Panel>
        </section>
      </div>
    </main>
  );
}
