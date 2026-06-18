import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  Building2,
  Check,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Home,
  Languages,
  LayoutGrid,
  LifeBuoy,
  Menu,
  MessageCircle,
  MessageSquare,
  Mic,
  Moon,
  Search,
  Send,
  ShieldCheck,
  Star,
  Sun,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Volume2,
  X,
  BookmarkPlus
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, Panel } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { UniMateLogo } from "@/components/brand/UniMateLogo";
import { cn, supportsSpeechRecognition, supportsSpeechSynthesis } from "@/lib/utils";
import { api } from "@/services/api";
import type { ChatResponse, ChecklistResponse, LanguageOption, Notice, NoticeExplainerResponse, OfficeContact } from "@/services/api";
import {
  detectUniversityService,
  resolveServiceUrl,
  universityLinks,
  type UniversityService
} from "@/config/universityLinks";
import {
  attendanceAnswer,
  gradesAnswer,
  quickCategories,
  trustPillars,
  type CategoryGroup
} from "./productData";
import { useAppStore } from "./store";

const AdminDashboard = lazy(() => import("./routes/AdminDashboard"));
const ProductBoardRoute = lazy(() => import("./routes/ProductBoard"));

const primaryNav = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/chat", icon: MessageCircle, label: "Chat" },
  { to: "/categories", icon: LayoutGrid, label: "Categories" },
  { to: "/notices", icon: Bell, label: "Notices" },
  { to: "/history", icon: Clock, label: "History" },
  { to: "/student", icon: Star, label: "Profile" }
];

const bottomNav = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/chat", icon: MessageCircle, label: "Chat" },
  { to: "/history", icon: Clock, label: "History" },
  { to: "/notices", icon: Bell, label: "Notices" },
  { to: "/student", icon: Star, label: "Profile" }
];

const secondaryNav = [
  { to: "/language", icon: Languages, label: "Language" },
  { to: "/feedback", icon: MessageSquare, label: "Feedback" },
  { to: "/handoff", icon: LifeBuoy, label: "Human Support" }
];

const quickLinkKeys = ["studentPortal", "lms", "library", "academicCalendar", "mainWebsite"] as const;

const answerActionLabels = ["Listen to answer", "Copy answer", "Mark answer helpful", "Mark answer not helpful"];

type RenderedAnswer = {
  confidence: string;
  title: string;
  summary: string;
  steps?: string[];
  sources: { title: string; url: string; lastUpdated?: string }[];
  actions: string[];
};

type ResourceState<T> = {
  data: T | null;
  isLoading: boolean;
  error: string;
  reload: () => void;
};

function useApiResource<T>(loader: () => Promise<T>, deps: unknown[] = []): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError("");
    loader()
      .then((result) => {
        if (isMounted) setData(result);
      })
      .catch((err) => {
        if (isMounted) setError(err instanceof Error ? err.message : "Unable to load data.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [reloadKey, ...deps]);

  return { data, isLoading, error, reload: () => setReloadKey((key) => key + 1) };
}

function useVoiceInput(onResult: (text: string) => void) {
  const supported = supportsSpeechRecognition();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  function toggle() {
    if (!supported) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SpeechRecognitionCtor = (window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    });
    const Ctor = SpeechRecognitionCtor.SpeechRecognition ?? SpeechRecognitionCtor.webkitSpeechRecognition;
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) onResult(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return { supported, listening, toggle };
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (event: { results?: Array<Array<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};

function openExternal(url: string) {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function InlineState({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "danger" }) {
  return <p className={cn("rounded-lg p-3 text-sm font-semibold", tone === "danger" ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-500")}>{label}</p>;
}

function RobotMascot({ dark = false }: { dark?: boolean }) {
  return (
    <div className={cn("relative h-20 w-20 rounded-3xl p-3 shadow-lg", dark ? "bg-slate-800" : "bg-white")}>
      <div className="mx-auto h-12 w-14 rounded-2xl bg-brand-600 p-2">
        <div className="flex h-full items-center justify-around rounded-xl bg-slate-950">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-sky-300" />
        </div>
      </div>
      <span className="absolute left-1/2 top-1 h-3 w-1 -translate-x-1/2 rounded-full bg-trust" />
    </div>
  );
}

function PhoneFrame({ children, dark = false, wide = false }: { children: ReactNode; dark?: boolean; wide?: boolean }) {
  return (
    <main
      className={cn(
        "mx-auto flex min-h-[640px] w-full flex-1 flex-col rounded-[28px] border shadow-soft safe-pad",
        wide ? "max-w-4xl" : "max-w-2xl",
        dark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-950"
      )}
    >
      {children}
    </main>
  );
}

function AppMenu({ dark = false }: { dark?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { darkMode, toggleDarkMode } = useAppStore();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("grid h-11 w-11 place-items-center rounded-xl lg:hidden", dark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-700")}
        aria-label={t("Open menu")}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button type="button" aria-label={t("Close menu")} className="absolute inset-0 bg-slate-950/40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[82%] max-w-xs flex-col gap-4 overflow-y-auto bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <UniMateLogo withWordmark size="sm" />
              <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-600" aria-label={t("Close menu")}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {[...primaryNav, ...secondaryNav].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold", isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50")}
                >
                  <item.icon className="h-5 w-5" />
                  {t(item.label)}
                </NavLink>
              ))}
            </nav>
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="px-1 text-xs font-bold uppercase tracking-wide text-slate-400">{t("UNIMATE services")}</p>
              {quickLinkKeys.map((key) => {
                const service = universityLinks[key];
                return (
                  <a key={key} href={resolveServiceUrl(service)} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                    {t(service.label)}
                    <ExternalLink className="h-4 w-4 text-brand-600" />
                  </a>
                );
              })}
            </div>
            <div className="mt-auto space-y-2 border-t border-slate-100 pt-3">
              <Button variant="outline" className="w-full justify-start" onClick={toggleDarkMode}>
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {darkMode ? t("Light mode") : t("Dark mode")}
              </Button>
              <Link to="/admin" onClick={() => setOpen(false)}>
                <Button className="w-full justify-start"><ShieldCheck className="h-4 w-4" />{t("Staff dashboard")}</Button>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function AppHeader({ title = "UniMate", dark = false }: { title?: string; dark?: boolean }) {
  const { t } = useTranslation();
  return (
    <header className="flex items-center justify-between px-4 pb-3">
      <Link to="/" aria-label={t("Go to UniMate home")} className="flex items-center gap-3 rounded-xl">
        <UniMateLogo badge size="sm" />
        <span>
          <span className={cn("block text-xs font-semibold", dark ? "text-slate-400" : "text-slate-500")}>{t("UNIMATE AI Assistant")}</span>
          <span className="block text-lg font-bold">{title === "UniMate" ? title : t(title)}</span>
        </span>
      </Link>
      <AppMenu dark={dark} />
    </header>
  );
}

function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav className="mt-auto grid grid-cols-5 gap-1 border-t border-slate-200 bg-white px-3 py-2 pb-[calc(0.5rem+var(--safe-bottom))] lg:hidden">
      {bottomNav.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => cn("flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium", isActive ? "text-brand-600" : "text-slate-500")}>
          <item.icon className="h-5 w-5" />
          {t(item.label)}
        </NavLink>
      ))}
    </nav>
  );
}

function Sidebar() {
  const { t } = useTranslation();
  const { darkMode, toggleDarkMode } = useAppStore();
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:flex">
      <Link to="/" className="flex items-center gap-3">
        <UniMateLogo badge size="md" />
        <span className="leading-tight">
          <span className="block text-lg font-extrabold text-brand-700 dark:text-white">UniMate</span>
          <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">{t("UNIMATE AI Assistant")}</span>
        </span>
      </Link>
      <nav className="space-y-1">
        {primaryNav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold", isActive ? "bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800")}>
            <item.icon className="h-5 w-5" />
            {t(item.label)}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-slate-100 pt-3 dark:border-slate-800">
        {secondaryNav.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold", isActive ? "bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800")}>
            <item.icon className="h-5 w-5" />
            {t(item.label)}
          </NavLink>
        ))}
      </div>
      <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <p className="px-1 text-xs font-bold uppercase tracking-wide text-slate-400">{t("UNIMATE services")}</p>
        {quickLinkKeys.map((key) => {
          const service = universityLinks[key];
          return (
            <a key={key} href={resolveServiceUrl(service)} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
              {t(service.label)}
              <ExternalLink className="h-4 w-4 text-brand-600" />
            </a>
          );
        })}
      </div>
      <div className="mt-auto space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <Button variant="outline" className="w-full justify-start dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" onClick={toggleDarkMode}>
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {darkMode ? t("Light mode") : t("Dark mode")}
        </Button>
        <Link to="/admin">
          <Button className="w-full justify-start"><ShieldCheck className="h-4 w-4" />{t("Staff dashboard")}</Button>
        </Link>
      </div>
    </aside>
  );
}

function AppShell() {
  const { darkMode } = useAppStore();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <div className="flex min-h-dvh bg-slate-100 dark:bg-slate-950">
      <Sidebar />
      <div className="flex min-h-dvh w-full flex-1 flex-col px-3 py-3 sm:px-5 lg:px-8 lg:py-6">
        <Outlet />
      </div>
    </div>
  );
}

function SourceCard({ title, url, lastUpdated }: { title: string; url: string; lastUpdated?: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
      <span>
        <span className="block text-sm font-semibold text-slate-800">{title}</span>
        {lastUpdated ? <span className="text-xs text-slate-500">Last updated: {lastUpdated}</span> : null}
      </span>
      <ArrowRight className="h-4 w-4 text-brand-600" />
    </a>
  );
}

function ServiceLinkCard({ service, dark = false }: { service: UniversityService; dark?: boolean }) {
  const { t } = useTranslation();
  return (
    <Panel className={cn("space-y-3", dark && "border-slate-700 bg-slate-900 text-slate-100")}>
      <div className="flex items-center gap-2 text-sm font-semibold text-brand-600">
        <ExternalLink className="h-4 w-4" />
        {t("University Service")}
      </div>
      <div>
        <p className={cn("text-base font-bold", dark ? "text-white" : "text-slate-950")}>{t(service.label)}</p>
        <p className={cn("mt-1 text-sm leading-6", dark ? "text-slate-300" : "text-slate-600")}>{service.description}</p>
      </div>
      <a
        href={resolveServiceUrl(service)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 w-full items-center justify-between rounded-lg bg-brand-600 px-4 text-sm font-bold text-white transition hover:bg-brand-700"
      >
        {t("Open {{name}}", { name: t(service.label) })}
        <ArrowRight className="h-4 w-4" />
      </a>
      {service.temporary ? (
        <p className={cn("text-xs", dark ? "text-slate-400" : "text-slate-500")}>
          {t("Temporary official website link until the in-app integration is connected.")}
        </p>
      ) : null}
    </Panel>
  );
}

function confidenceLabel(confidence: string) {
  return confidence.toLowerCase().includes("high") ? "High" : confidence.toLowerCase().includes("medium") ? "Medium" : confidence.toLowerCase().includes("low") ? "Low" : confidence;
}

function liveAnswerToCard(response: ChatResponse): RenderedAnswer {
  return {
    confidence: confidenceLabel(response.confidence),
    title: response.requires_handoff ? "Human Support Recommended" : "Verified Answer",
    summary: response.answer,
    steps: undefined,
    sources: response.citations.map((source) => ({
      title: source.title,
      url: source.url,
      lastUpdated: source.last_updated ?? undefined
    })),
    actions: response.suggested_next_actions.length
      ? response.suggested_next_actions
      : response.requires_handoff
        ? ["Contact the routed office", "Search official notices"]
        : ["Ask a follow-up question"]
  };
}

function getSavedAnswers(): RenderedAnswer[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem("unimate_saved_answers") ?? "[]") as RenderedAnswer[];
  } catch {
    return [];
  }
}

function saveAnswer(answer: RenderedAnswer) {
  if (typeof window === "undefined") return;
  const saved = getSavedAnswers();
  window.localStorage.setItem("unimate_saved_answers", JSON.stringify([{ ...answer }, ...saved].slice(0, 20)));
}

function VerifiedAnswer({ variant = "attendance", dark = false, response, question = "" }: { variant?: "attendance" | "grades"; dark?: boolean; response?: ChatResponse; question?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const answer: RenderedAnswer = response ? liveAnswerToCard(response) : variant === "attendance" ? attendanceAnswer : gradesAnswer;
  const [actionStatus, setActionStatus] = useState("");

  async function submitFeedback(helpful: boolean) {
    try {
      await (helpful ? api.feedback({ helpful, reasons: [] }) : api.reportAnswer({ helpful, reasons: ["not_helpful"], comment: question || null }));
      setActionStatus(helpful ? "Thanks, marked helpful." : "Thanks, reported for review.");
    } catch (err) {
      setActionStatus(err instanceof Error ? err.message : "Unable to send feedback.");
    }
  }

  async function copyAnswer() {
    try {
      await navigator.clipboard?.writeText(answer.summary);
      setActionStatus("Answer copied.");
    } catch {
      setActionStatus("Copy is unavailable in this browser.");
    }
  }

  function speakAnswer() {
    if (!supportsSpeechSynthesis()) {
      setActionStatus("Text-to-speech is unavailable in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(answer.summary));
    setActionStatus("Reading answer aloud.");
  }

  async function createHandoff() {
    try {
      const ticket = await api.handoffTicket({ question: question || answer.summary, language: response?.language ?? "en", office_name: response?.routed_office ?? null });
      setActionStatus(`Handoff created for ${ticket.office_name}.`);
    } catch {
      navigate("/handoff", { state: { question: question || answer.summary } });
    }
  }

  function runAction(action: string) {
    const lower = action.toLowerCase();
    if (lower.includes("contact") || lower.includes("human") || lower.includes("office") || lower.includes("iac") || lower.includes("center")) {
      void createHandoff();
      return;
    }
    if (lower.includes("follow-up") || lower.includes("ask")) {
      setActionStatus("Type your follow-up question below.");
      return;
    }
    const service = detectUniversityService(action) ?? detectUniversityService(question) ?? universityLinks.mainWebsite;
    openExternal(resolveServiceUrl(service));
    setActionStatus(`Opening ${service.label}...`);
  }

  return (
    <Panel className={cn("space-y-4", dark && "border-slate-700 bg-slate-900 text-slate-100")}>
      <div className="flex items-center gap-2 text-sm font-semibold text-trust">
        <ShieldCheck className="h-5 w-5" />
        {response?.requires_handoff ? t("Needs Human Review") : t("Verified Answer")}
        <span className="ml-auto rounded-full bg-green-50 px-2 py-1 text-xs text-trust">{t("{{level}} confidence", { level: t(answer.confidence) })}</span>
      </div>
      <div>
        <h2 className={cn("text-base font-bold", dark ? "text-white" : "text-slate-950")}>{answer.title}</h2>
        <p className={cn("mt-1 text-sm leading-6", dark ? "text-slate-300" : "text-slate-600")}>{answer.summary}</p>
      </div>
      {answer.steps ? (
        <ol className="space-y-2">
          {answer.steps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="grid gap-2">
        {answer.actions.map((action, index) => (
          <Button key={`${action}-${index}`} variant={dark ? "outline" : "secondary"} onClick={() => runAction(action)} className={cn("justify-between", dark && "border-slate-700 bg-slate-950 text-slate-100")}>
            {action}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ))}
      </div>
      <div className="space-y-2">
        <p className={cn("text-xs font-semibold uppercase", dark ? "text-slate-400" : "text-slate-500")}>{t("Sources")}</p>
        {answer.sources.length ? answer.sources.map((source, index) => (
          <SourceCard key={`${source.title}-${index}`} {...source} />
        )) : <p className={cn("rounded-lg p-3 text-sm", dark ? "bg-slate-950 text-slate-300" : "bg-slate-50 text-slate-500")}>{t("No official source was returned for this answer.")}</p>}
      </div>
      <div className={cn("flex items-center gap-2 border-t pt-3", dark ? "border-slate-700" : "border-slate-100")}>
        <button type="button" onClick={speakAnswer} className={cn("grid h-10 w-10 place-items-center rounded-lg", dark ? "bg-slate-950 text-slate-300" : "bg-slate-50 text-slate-600")} aria-label={answerActionLabels[0]}><Volume2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => void copyAnswer()} className={cn("grid h-10 w-10 place-items-center rounded-lg", dark ? "bg-slate-950 text-slate-300" : "bg-slate-50 text-slate-600")} aria-label={answerActionLabels[1]}><Copy className="h-4 w-4" /></button>
        <button type="button" onClick={() => void submitFeedback(true)} className={cn("grid h-10 w-10 place-items-center rounded-lg", dark ? "bg-slate-950 text-slate-300" : "bg-slate-50 text-slate-600")} aria-label={answerActionLabels[2]}><ThumbsUp className="h-4 w-4" /></button>
        <button type="button" onClick={() => void submitFeedback(false)} className={cn("grid h-10 w-10 place-items-center rounded-lg", dark ? "bg-slate-950 text-slate-300" : "bg-slate-50 text-slate-600")} aria-label={answerActionLabels[3]}><ThumbsDown className="h-4 w-4" /></button>
        <button type="button" onClick={() => { saveAnswer(answer); setActionStatus("Answer saved."); }} className={cn("grid h-10 w-10 place-items-center rounded-lg", dark ? "bg-slate-950 text-slate-300" : "bg-slate-50 text-slate-600")} aria-label="Save answer"><BookmarkPlus className="h-4 w-4" /></button>
        {response?.requires_handoff ? <button type="button" onClick={() => void createHandoff()} className={cn("grid h-10 w-10 place-items-center rounded-lg", dark ? "bg-slate-950 text-slate-300" : "bg-slate-50 text-slate-600")} aria-label="Create handoff"><ExternalLink className="h-4 w-4" /></button> : null}
      </div>
      {actionStatus ? <p className={cn("text-xs font-semibold", dark ? "text-slate-300" : "text-slate-500")}>{actionStatus}</p> : null}
    </Panel>
  );
}

function ChatInput({ dark = false, onSend, disabled = false, placeholder = "Ask follow-up question..." }: { dark?: boolean; onSend?: (message: string) => void; disabled?: boolean; placeholder?: string }) {
  const { t } = useTranslation();
  const questionId = useId();
  const [message, setMessage] = useState("");
  const voice = useVoiceInput((text) => setMessage((current) => (current ? `${current} ${text}` : text)));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    onSend?.(trimmed);
    setMessage("");
  }

  return (
    <form onSubmit={handleSubmit} className={cn("sticky bottom-0 mt-auto flex gap-2 border-t p-3 pb-[calc(0.75rem+var(--safe-bottom))]", dark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white")}>
      <label htmlFor={questionId} className="sr-only">Ask UniMate</label>
      <Input id={questionId} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={voice.listening ? t("Listening...") : t(placeholder)} disabled={disabled} className={cn(dark && "border-slate-700 bg-slate-900 text-white")} />
      <Button
        type="button"
        onClick={voice.toggle}
        variant={voice.listening ? "primary" : voice.supported ? "outline" : "ghost"}
        disabled={!voice.supported}
        aria-label={!voice.supported ? t("Voice input unavailable in this browser") : voice.listening ? t("Stop voice input") : t("Start voice input")}
        aria-pressed={voice.listening}
        className={cn("w-11 px-0", dark && !voice.listening && "border-slate-700 bg-slate-900 text-white")}
      >
        <Mic className="h-4 w-4" />
      </Button>
      <Button type="submit" aria-label={t("Send message")} className="w-11 px-0" disabled={disabled}>
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}

export function BrandPanel() {
  return (
    <aside className="hidden w-[300px] shrink-0 rounded-2xl bg-white p-6 shadow-soft lg:block">
      <h1 className="text-4xl font-extrabold leading-none text-brand-700">UniMate<br />University Assistant</h1>
      <p className="mt-3 inline-flex rounded-lg bg-brand-600 px-3 py-2 text-lg font-bold text-white">UNIMATE AI Assistant</p>
      <p className="mt-5 text-sm leading-6 text-slate-600">A verified multilingual university assistant for academic support, campus services, and student guidance.</p>
      <div className="mt-6 space-y-4">
        {trustPillars.map((pillar) => (
          <div key={pillar.title} className="flex gap-3">
            <pillar.icon className="mt-1 h-6 w-6 shrink-0 text-brand-600" />
            <div>
              <p className="font-bold text-slate-900">{pillar.title}</p>
              <p className="text-sm text-slate-600">{pillar.text}</p>
            </div>
          </div>
        ))}
      </div>
      <Panel className="mt-6 bg-brand-50">
        <p className="font-bold text-brand-900">Our Mission</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">Helping students, faculty, and staff succeed at UNIMATE University through smart, trustworthy AI assistance.</p>
      </Panel>
      <div className="mt-6 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
        {["Trust & Accuracy", "Accessibility", "Simplicity", "Inclusivity", "Actionable"].map((item) => (
          <span key={item} className="rounded-lg border border-slate-200 p-2 text-center">{item}</span>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 p-3">
        <UniMateLogo size="md" />
        <span className="text-sm font-bold text-slate-700">UNIMATE University<br />Smart Campus Integrated</span>
      </div>
    </aside>
  );
}

export function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const campusServices: { label: string; to?: string; question?: string }[] = [
    { label: "Student ID", to: "/student-id" },
    { label: "Cafeteria Menu", question: "Show me the cafeteria menu and campus facilities." },
    { label: "Health Center", question: "I need health center and health insurance information." },
    { label: "Counseling Center", question: "How do I reach the counseling center?" }
  ];

  return (
    <PhoneFrame>
      <header className="px-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UniMateLogo badge size="sm" />
            <div>
              <p className="text-sm font-bold text-slate-800">{t("Smart Campus")}</p>
              <p className="mt-1 text-sm text-slate-600">{t("Welcome to UNIMATE, how can we help you today?")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/notices" className="grid h-11 w-11 place-items-center rounded-xl bg-white text-slate-600" aria-label={t("View notices")}>
              <Bell className="h-5 w-5" />
            </Link>
            <AppMenu />
          </div>
        </div>
      </header>
      <section className="px-4">
        <Card className="overflow-hidden bg-gradient-to-br from-brand-600 to-brand-900 p-5 text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-100">{t("UNIMATE AI Assistant")}</p>
              <h2 className="mt-1 text-2xl font-extrabold">UniMate</h2>
              <p className="mt-2 text-sm text-blue-100">{t("Ask anything about academic support, campus life, services, and more.")}</p>
            </div>
            <RobotMascot />
          </div>
          <Link to="/chat" className="mt-5 flex min-h-11 items-center justify-between rounded-lg bg-white px-4 text-sm font-bold text-brand-700">
            {t("Chat with UniMate")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </section>
      <section className="mt-5 px-4">
        <h2 className="text-sm font-bold text-slate-800">{t("Quick Access")}</h2>
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {quickCategories.slice(0, 8).map((item) => (
            <button key={item.title} type="button" onClick={() => navigate("/chat/attendance", { state: { question: item.title.split(" / ")[0] } })} className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 text-center text-[11px] font-semibold text-slate-600 shadow-sm transition hover:bg-brand-50">
              <item.icon className="h-5 w-5 text-brand-600" />
              {item.title.split(" ")[0]}
            </button>
          ))}
        </div>
      </section>
      <section className="mt-5 px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">{t("Campus Services")}</h2>
          <Link to="/categories" className="flex items-center gap-1 text-xs font-semibold text-brand-600">{t("View all")} <ChevronRight className="h-4 w-4" /></Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {campusServices.map((service) => (
            <button
              key={service.label}
              type="button"
              onClick={() => service.to ? navigate(service.to) : navigate("/chat/attendance", { state: { question: service.question } })}
              className="rounded-xl border border-slate-200 bg-white p-3 text-left font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50"
            >
              {t(service.label)}
            </button>
          ))}
        </div>
      </section>
      <p className="mt-5 px-4 text-center text-xs text-slate-500">{t("Verified answers from official UNIMATE sources.")}</p>
      <BottomNav />
    </PhoneFrame>
  );
}

export function ChatLanding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language, autoDetect } = useAppStore();
  const [message, setMessage] = useState("");
  const voice = useVoiceInput((text) => setMessage((current) => (current ? `${current} ${text}` : text)));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    navigate("/chat/attendance", { state: { question: trimmed, language: autoDetect ? null : language } });
  }

  return (
    <PhoneFrame>
      <AppHeader />
      <section className="space-y-4 px-4">
        <Card className="bg-gradient-to-br from-brand-600 to-brand-900 p-5 text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-blue-100">{t("UNIMATE AI Assistant")}</p>
              <h2 className="mt-2 text-xl font-extrabold">{t("Hi, I’m UniMate. How can I help you today?")}</h2>
            </div>
            <RobotMascot />
          </div>
        </Card>
        <div>
          <p className="text-sm font-bold text-slate-800">{t("Popular")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Attendance", "Grades", "Scholarship", "Student ID", "Class Schedule", "Campus Life"].map((chip) => (
              <Link key={chip} to={chip === "Grades" ? "/chat/grades" : chip === "Student ID" ? "/student-id" : "/chat/attendance"} state={{ question: chip }} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50">
                {t(chip)}
              </Link>
            ))}
          </div>
        </div>
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-2">
          <div className="flex gap-2">
            <label htmlFor="chat-landing-question" className="sr-only">Ask UniMate</label>
            <Input id="chat-landing-question" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={voice.listening ? t("Listening...") : t("Ask me anything...")} />
            <Button type="button" onClick={voice.toggle} variant={voice.listening ? "primary" : "outline"} disabled={!voice.supported} className="w-11 px-0" aria-label={!voice.supported ? t("Voice input unavailable in this browser") : voice.listening ? t("Stop voice input") : t("Start voice input")} aria-pressed={voice.listening}>
              <Mic className="h-4 w-4" />
            </Button>
            <Button type="submit" className="w-11 px-0" aria-label={t("Send message")}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
        <p className="text-xs text-slate-500">{t("Verified answers from official UNIMATE sources. Sensitive topics are routed to human offices when needed.")}</p>
      </section>
      <BottomNav />
    </PhoneFrame>
  );
}

const categoryTabs: ("All" | CategoryGroup)[] = ["All", "Academics", "Campus Life", "Services"];

export function CategoriesScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<(typeof categoryTabs)[number]>("All");
  const filtered = activeTab === "All" ? quickCategories : quickCategories.filter((item) => item.group === activeTab);

  return (
    <PhoneFrame>
      <AppHeader title="Quick Help Categories" />
      <div className="px-4">
        <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
          {categoryTabs.map((tab) => (
            <button key={tab} type="button" aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)} className={cn("rounded-full px-4 py-2 text-sm font-bold transition", activeTab === tab ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100")}>{t(tab)}</button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((item) => (
            <button key={item.title} type="button" onClick={() => navigate("/chat/attendance", { state: { question: item.title.split(" / ")[0] } })} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <item.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900">{item.title}</span>
                <span className="block text-xs leading-5 text-slate-500">{item.description}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          ))}
        </div>
      </div>
      <BottomNav />
    </PhoneFrame>
  );
}

export function ChatConversation({ variant = "attendance" }: { variant?: "attendance" | "grades" }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { language, autoDetect } = useAppStore();
  const state = location.state as { question?: string; language?: string | null } | null;
  const initialQuestion = state?.question ?? (variant === "grades" ? "Where can I check my grades?" : "How do I record my attendance?");
  // When auto-detect is on, send null so the backend detects the language from the message.
  const requestLanguage = autoDetect ? null : state?.language ?? language;
  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState<ChatResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const detectedService = useMemo(() => detectUniversityService(question), [question]);

  async function askUniMate(message: string, nextLanguage: string | null = requestLanguage) {
    setQuestion(message);
    setAnswer(null);
    setError("");
    setIsLoading(true);
    try {
      const response = await api.chat(message, nextLanguage);
      setAnswer(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "UniMate could not reach the answer service.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void askUniMate(initialQuestion, requestLanguage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, requestLanguage]);

  return (
    <PhoneFrame wide>
      <AppHeader />
      <div className="flex-1 space-y-4 overflow-y-auto px-4">
        <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-md bg-brand-600 px-4 py-3 text-sm font-semibold text-white">
          {question}
        </div>
        {detectedService ? <ServiceLinkCard service={detectedService} /> : null}
        {isLoading ? (
          <Panel className="space-y-3">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
            <p className="text-sm font-semibold text-slate-500">{t("Checking official UNIMATE sources...")}</p>
          </Panel>
        ) : error ? (
          <Panel className="space-y-3 border-red-200 bg-red-50">
            <div className="flex items-center gap-2 font-bold text-red-700">
              <AlertTriangle className="h-5 w-5" />
              {t("Answer service unavailable")}
            </div>
            <p className="text-sm leading-6 text-red-700">{error}</p>
            {detectedService ? (
              <p className="text-sm text-red-700">{t("You can still use the official UNIMATE link above while the answer service is offline.")}</p>
            ) : null}
            <Button variant="outline" className="bg-white" onClick={() => void askUniMate(question)}>
              {t("Try Again")}
            </Button>
          </Panel>
        ) : answer ? (
          <VerifiedAnswer variant={variant} response={answer} question={question} />
        ) : (
          <VerifiedAnswer variant={variant} question={question} />
        )}
      </div>
      <ChatInput onSend={(message) => void askUniMate(message)} disabled={isLoading} />
    </PhoneFrame>
  );
}

export function StudentIdGuide() {
  const { t } = useTranslation();
  return (
    <PhoneFrame>
      <AppHeader />
      <div className="space-y-4 px-4">
        <div className="ml-auto rounded-2xl rounded-tr-md bg-brand-600 px-4 py-3 text-sm font-semibold text-white">{t("How do I get my student ID card?")}</div>
        <Panel className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-trust">
            <ShieldCheck className="h-5 w-5" />
            {t("Step-by-step Guide")}
          </div>
          {["Apply Online", "Upload Photo", "Pay the Fee", "Pick Up Your ID"].map((step, index) => (
            <div key={step} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{index + 1}</span>
              <div>
                <p className="text-sm font-bold text-slate-900">{step}</p>
                <p className="text-xs leading-5 text-slate-500">{index === 0 ? "Go to Smart Campus student services." : index === 1 ? "Upload a recent photo that meets requirements." : index === 2 ? "Pay the ID card fee online if required." : "Collect your card at Student Welfare Center."}</p>
              </div>
            </div>
          ))}
          <div className="grid gap-2 pt-2">
            <Button variant="secondary" onClick={() => openExternal(resolveServiceUrl(universityLinks.studentPortal))} className="justify-between">
              {t("View Detailed Guide")}
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Link to="/handoff" state={{ question: "I need help getting my student ID card." }}>
              <Button variant="outline" className="w-full justify-between">
                {t("Contact Student Welfare Center")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Panel>
      </div>
      <ChatInput />
    </PhoneFrame>
  );
}

export function UnverifiedScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const actions = [
    { label: "Search official notices", onClick: () => navigate("/notices") },
    { label: "Show related pages", onClick: () => openExternal(resolveServiceUrl(universityLinks.mainWebsite)) },
    { label: "Contact the correct office", onClick: () => navigate("/handoff") }
  ];

  return (
    <PhoneFrame>
      <AppHeader />
      <div className="space-y-4 px-4">
        <div className="ml-auto rounded-2xl rounded-tr-md bg-brand-600 px-4 py-3 text-sm font-semibold text-white">Is there a reading week next month?</div>
        <Panel className="space-y-4 border-orange-200 bg-orange-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-warn" />
            <h2 className="text-base font-bold text-slate-900">{t("I could not verify this from the available UNIMATE University sources.")}</h2>
          </div>
          <p className="text-sm text-slate-600">{t("This information may change. Please check official notices or contact the relevant office.")}</p>
          <div className="grid gap-2">
            {actions.map((action) => (
              <Button key={action.label} variant="outline" className="justify-start bg-white" onClick={action.onClick}>
                <Search className="h-4 w-4" />
                {t(action.label)}
              </Button>
            ))}
          </div>
        </Panel>
      </div>
      <ChatInput />
    </PhoneFrame>
  );
}

export function HandoffScreen() {
  const { t } = useTranslation();
  const location = useLocation();
  const { language } = useAppStore();
  const presetQuestion = (location.state as { question?: string } | null)?.question ?? "";
  const officesResource = useApiResource<OfficeContact[]>(api.offices);
  const [mode, setMode] = useState<"office" | "ticket">("office");
  const [selectedOffice, setSelectedOffice] = useState("");
  const [question, setQuestion] = useState(presetQuestion);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const officeRows = officesResource.data ?? [];

  async function submitTicket() {
    if (!question.trim()) {
      setStatus(t("Add a question so the office has context."));
      return;
    }
    try {
      const ticket = await api.handoffTicket({ question, language, user_email: email || null, office_name: selectedOffice || null });
      setStatus(`Ticket created for ${ticket.office_name}.`);
      setQuestion("");
      setEmail("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to create support ticket.");
    }
  }

  return (
    <PhoneFrame>
      <AppHeader title="Connect with a Human" />
      <div className="space-y-4 px-4">
        <p className="text-sm text-slate-600">{t("Our team is ready to help. Choose an office or create a support ticket.")}</p>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-1">
          <Button variant={mode === "office" ? "primary" : "ghost"} onClick={() => setMode("office")}>{t("By Office")}</Button>
          <Button variant={mode === "ticket" ? "primary" : "ghost"} onClick={() => setMode("ticket")}>{t("Support Ticket")}</Button>
        </div>
        {mode === "office" ? (
          <div className="space-y-2">
            {officesResource.isLoading ? <InlineState label={t("Loading offices...")} /> : officesResource.error ? <InlineState label={officesResource.error} tone="danger" /> : officeRows.length ? officeRows.map((office) => (
              <button key={office.name} type="button" onClick={() => { setSelectedOffice(office.name); setMode("ticket"); }} className={cn("flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left", selectedOffice === office.name && "border-brand-500 ring-2 ring-brand-100")}>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <Building2 className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-bold text-slate-900">{office.name}</span>
                  <span className="text-xs text-slate-500">{office.purpose}</span>
                  {office.email ? <span className="mt-1 block text-xs font-semibold text-brand-600">{office.email}</span> : null}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            )) : <InlineState label={t("No offices are available right now.")} />}
          </div>
        ) : (
          <div className="space-y-3">
            {selectedOffice ? <p className="text-sm font-semibold text-brand-700">{selectedOffice}</p> : null}
            <label htmlFor="handoff-question" className="sr-only">Question for support</label>
            <textarea id="handoff-question" value={question} onChange={(event) => setQuestion(event.target.value)} className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder={t("What do you need help with?")} />
            <label htmlFor="handoff-email" className="sr-only">Email optional</label>
            <Input id="handoff-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("Email optional")} />
            <Button className="w-full" onClick={() => void submitTicket()}>{t("Create a Support Ticket")}</Button>
          </div>
        )}
        {status ? <InlineState label={status} tone={status.toLowerCase().includes("unable") || status.toLowerCase().includes("add a question") ? "danger" : "neutral"} /> : null}
        <p className="text-center text-xs text-slate-500">{t("Average response time: within 1 business day.")}</p>
      </div>
      <BottomNav />
    </PhoneFrame>
  );
}

export function LanguageScreen() {
  const { t } = useTranslation();
  const { language, autoDetect, setLanguage, toggleAutoDetect } = useAppStore();
  const languagesResource = useApiResource<LanguageOption[]>(api.languages);
  const languageRows = (languagesResource.data ?? []).filter((row) => row.enabled ?? true);
  return (
    <PhoneFrame>
      <AppHeader title="Select Language" />
      <div className="space-y-3 px-4">
        <p className="text-sm text-slate-500">{t("Keep auto-detect on to answer in the language you type, or pick a fixed language.")}</p>
        <Panel className="flex items-center justify-between gap-3 p-3">
          <span>
            <span className="block font-semibold">{t("Auto-detect language")}</span>
            <span className="block text-xs text-slate-500">{t("Detects the language from each message you send.")}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={autoDetect}
            aria-label={t("Toggle auto-detect language")}
            onClick={toggleAutoDetect}
            className={cn("relative h-7 w-12 shrink-0 rounded-full transition", autoDetect ? "bg-trust" : "bg-slate-300")}
          >
            <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", autoDetect ? "left-6" : "left-1")} />
          </button>
        </Panel>
        <p className="text-xs font-semibold text-slate-500">{autoDetect ? t("Auto-detect is on. Selecting a language below will switch to that language.") : t("Answering in: {{lang}}", { lang: language.toUpperCase() })}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {languagesResource.isLoading ? <InlineState label={t("Loading languages...")} /> : languagesResource.error ? <InlineState label={languagesResource.error} tone="danger" /> : languageRows.length ? languageRows.map((row) => {
            const code = row.code;
            const label = `${row.nativeName ?? row.native_name ?? code} · ${row.englishName ?? row.english_name ?? code}`;
            const selected = !autoDetect && language === code;
            return (
            <button key={code} type="button" aria-pressed={selected} onClick={() => setLanguage(code)} className={cn("flex min-h-12 w-full items-center justify-between rounded-xl border bg-white px-4 text-left text-sm font-semibold", selected ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-200")}>
              {label}
              <span className={cn("grid h-5 w-5 place-items-center rounded-full border", selected ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300")}>
                {selected ? <Check className="h-3 w-3" /> : null}
              </span>
            </button>
            );
          }) : <InlineState label={t("No languages are available right now.")} />}
        </div>
      </div>
      <BottomNav />
    </PhoneFrame>
  );
}

const recentHistory = ["How do I record attendance?", "Where can I check my grades?", "How do I get my student ID card?", "Scholarship eligibility", "Dormitory application", "Tuition payment methods", "Parking permit"];

export function HistoryScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"recent" | "saved">("recent");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<RenderedAnswer[]>(() => getSavedAnswers());
  const [status, setStatus] = useState("");

  const filteredRecent = recentHistory.filter((row) => row.toLowerCase().includes(query.toLowerCase()));
  const filteredSaved = saved.filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(query.toLowerCase()));

  function clearHistory() {
    if (tab === "saved") {
      window.localStorage.removeItem("unimate_saved_answers");
      setSaved([]);
      setStatus(t("Saved answers cleared."));
    } else {
      setStatus(t("Recent history is kept only for this session."));
    }
  }

  return (
    <PhoneFrame>
      <AppHeader title="Chat History" />
      <div className="space-y-4 px-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-1">
          <Button variant={tab === "recent" ? "primary" : "ghost"} onClick={() => setTab("recent")}>{t("Recent")}</Button>
          <Button variant={tab === "saved" ? "primary" : "ghost"} onClick={() => setTab("saved")}>{t("Saved")}</Button>
        </div>
        <label htmlFor="history-search" className="sr-only">Search chat history</label>
        <Input id="history-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search chat history")} />
        {tab === "recent" ? (
          <div className="space-y-1">
            {filteredRecent.length ? filteredRecent.map((row, index) => (
              <Link key={row} to="/chat/attendance" state={{ question: row }} className="flex items-center justify-between rounded-xl bg-white p-3 text-sm transition hover:bg-brand-50">
                <span className="font-semibold text-slate-800">{row}</span>
                <span className="text-xs text-slate-400">{index < 3 ? "Today" : "This week"}</span>
              </Link>
            )) : <InlineState label={t("No matching history.")} />}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredSaved.length ? filteredSaved.map((item, index) => (
              <Link key={`${item.title}-${index}`} to="/chat/attendance" state={{ question: item.title }} className="block rounded-xl bg-white p-3 text-sm transition hover:bg-brand-50">
                <span className="block font-semibold text-slate-800">{item.title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500 line-clamp-2">{item.summary}</span>
              </Link>
            )) : <InlineState label={t("No saved answers yet. Tap the bookmark on any answer to save it.")} />}
          </div>
        )}
        {status ? <InlineState label={status} /> : null}
        <Button variant="outline" className="w-full" onClick={clearHistory}>
          <Trash2 className="h-4 w-4" />
          {tab === "saved" ? t("Clear Saved Answers") : t("Clear History")}
        </Button>
      </div>
      <BottomNav />
    </PhoneFrame>
  );
}

export function FeedbackScreen() {
  const { t } = useTranslation();
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const reasons = ["Unclear", "Outdated", "Missing source", "Wrong office", "Incomplete", "Need human help"];

  function toggleReason(reason: string) {
    setSelectedReasons((current) => current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]);
  }

  async function submitFeedback() {
    if (helpful === null) {
      setStatus(t("Choose helpful or not helpful first."));
      return;
    }
    setIsSubmitting(true);
    setStatus("");
    try {
      await api.feedback({ helpful, reasons: selectedReasons, comment: comment || null });
      setStatus(t("Feedback submitted. Thank you."));
      setHelpful(null);
      setSelectedReasons([]);
      setComment("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to submit feedback.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PhoneFrame>
      <AppHeader title="Feedback" />
      <div className="space-y-4 px-4">
        <h2 className="text-xl font-bold text-slate-950">{t("How was this answer?")}</h2>
        <p className="text-sm text-slate-500">{t("Your feedback helps us improve verified answers.")}</p>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setHelpful(true)} aria-pressed={helpful === true} className={cn("h-24 flex-col text-trust", helpful === true && "ring-2 ring-green-200")}><ThumbsUp className="h-7 w-7" />{t("Helpful")}</Button>
          <Button variant="danger" onClick={() => setHelpful(false)} aria-pressed={helpful === false} className={cn("h-24 flex-col", helpful === false && "ring-2 ring-red-200")}><ThumbsDown className="h-7 w-7" />{t("Not helpful")}</Button>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-slate-800">{t("Why was it not helpful?")}</p>
          <div className="flex flex-wrap gap-2">
            {reasons.map((reason) => (
              <button key={reason} type="button" onClick={() => toggleReason(reason)} aria-pressed={selectedReasons.includes(reason)} className={cn("rounded-full border px-3 py-2 text-sm font-semibold", selectedReasons.includes(reason) ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600")}>{t(reason)}</button>
            ))}
          </div>
        </div>
        <label htmlFor="feedback-comments" className="sr-only">Additional comments</label>
        <textarea id="feedback-comments" value={comment} onChange={(event) => setComment(event.target.value)} className="min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder={t("Additional comments optional")} />
        {status ? <InlineState label={status} tone={status.toLowerCase().includes("unable") || status.toLowerCase().includes("choose") ? "danger" : "neutral"} /> : null}
        <Button className="w-full" onClick={() => void submitFeedback()} disabled={isSubmitting}>{isSubmitting ? t("Submitting...") : t("Submit Feedback")}</Button>
      </div>
      <BottomNav />
    </PhoneFrame>
  );
}

export function StudentDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language } = useAppStore();
  const checklist = useApiResource<ChecklistResponse>(() => api.checklist("new_student", language), [language]);
  return (
    <PhoneFrame>
      <AppHeader title="Student Assistant" />
      <div className="space-y-4 px-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950">Good morning, Minji</h2>
          <p className="text-sm text-slate-500">{t("Here is your campus update.")}</p>
        </div>
        <Panel>
          <div className="flex items-center justify-between">
            <h3 className="font-bold">{t("Today’s Classes")}</h3>
            <Button variant="ghost" className="min-h-0 px-2 py-1 text-xs" onClick={() => navigate("/categories")}>{t("View Schedule")}</Button>
          </div>
          {["09:00 AM Data Structures (CS201)", "11:00 AM English Communication"].map((klass) => (
            <p key={klass} className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700">{klass}</p>
          ))}
        </Panel>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" className="h-16 flex-col" onClick={() => navigate("/chat/attendance", { state: { question: "How do I record my attendance?" } })}><ShieldCheck className="h-5 w-5" />{t("Attendance")}</Button>
          <Button variant="secondary" className="h-16 flex-col" onClick={() => openExternal(resolveServiceUrl(universityLinks.library))}><BookOpen className="h-5 w-5" />{t("Library")}</Button>
        </div>
        <Panel>
          <h3 className="font-bold">{t("Important for You")}</h3>
          {["Tuition Payment Due", "Scholarship Notice"].map((item, index) => (
            <button key={item} type="button" onClick={() => navigate("/notices")} className="mt-3 flex w-full items-center justify-between rounded-lg bg-slate-50 p-3 text-left transition hover:bg-brand-50">
              <span>
                <span className="block text-sm font-bold text-slate-800">{item}</span>
                <span className="text-xs text-slate-500">{index === 0 ? "Due on May 30, 2026" : "2026-2 scholarship applications open"}</span>
              </span>
              <span className={cn("rounded-full px-2 py-1 text-xs font-bold", index === 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-trust")}>{index === 0 ? "D-5" : "New"}</span>
            </button>
          ))}
        </Panel>
        <Panel>
          <h3 className="font-bold">{checklist.data?.title ?? t("Arrival Checklist")}</h3>
          <div className="mt-3 space-y-2">
            {checklist.isLoading ? <InlineState label={t("Loading checklist...")} /> : checklist.error ? <InlineState label={checklist.error} tone="danger" /> : checklist.data?.items.length ? checklist.data.items.slice(0, 4).map((item) => (
              <p key={item} className="flex items-center gap-2 text-sm text-slate-600"><Check className="h-4 w-4 text-trust" />{item}</p>
            )) : <InlineState label={t("No checklist items available.")} />}
          </div>
        </Panel>
      </div>
      <BottomNav />
    </PhoneFrame>
  );
}

const noticeTabs = ["All", "Announcement", "Deadline", "Alert"] as const;

export function NoticesScreen() {
  const { t } = useTranslation();
  const { language } = useAppStore();
  const noticesResource = useApiResource<Notice[]>(api.notices);
  const [activeTab, setActiveTab] = useState<(typeof noticeTabs)[number]>("All");
  const [explainer, setExplainer] = useState<NoticeExplainerResponse | null>(null);
  const [explainingTitle, setExplainingTitle] = useState("");
  const [explainError, setExplainError] = useState("");
  const noticeRows = (noticesResource.data ?? []).filter((notice) => activeTab === "All" || notice.category === activeTab);

  async function explainNotice(notice: Notice) {
    setExplainingTitle(notice.title);
    setExplainError("");
    try {
      const response = await api.explainNotice(`${notice.title}\n${notice.description}`, language);
      setExplainer(response);
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : "Unable to explain notice.");
    } finally {
      setExplainingTitle("");
    }
  }

  return (
    <PhoneFrame>
      <AppHeader title="Notices" />
      <div className="space-y-4 px-4">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {noticeTabs.map((tab) => (
            <button key={tab} type="button" aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)} className={cn("rounded-full px-3 py-2 text-sm font-bold transition", activeTab === tab ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100")}>{tab === "All" ? t("All") : t(`${tab}s`)}</button>
          ))}
        </div>
        {noticesResource.isLoading ? <InlineState label={t("Loading notices...")} /> : noticesResource.error ? <InlineState label={noticesResource.error} tone="danger" /> : noticeRows.length ? noticeRows.map((notice) => (
          <Panel key={notice.title} className="flex items-start gap-3 p-3">
            <span className={cn("mt-1 grid h-9 w-9 place-items-center rounded-lg", notice.category === "Alert" ? "bg-orange-50 text-warn" : notice.category === "Deadline" ? "bg-red-50 text-red-600" : "bg-green-50 text-trust")}>
              <Bell className="h-4 w-4" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-slate-900">{notice.title}</span>
              <span className="text-xs font-semibold text-slate-500">{notice.category} · {notice.date}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{notice.description}</span>
              <span className="mt-2 flex flex-wrap gap-2">
                <Button variant="secondary" className="min-h-0 px-3 py-1 text-xs" onClick={() => void explainNotice(notice)} disabled={explainingTitle === notice.title}>
                  {explainingTitle === notice.title ? t("Explaining...") : t("Explain")}
                </Button>
                {notice.source_url ? <a href={notice.source_url} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">{t("Source")} <ExternalLink className="h-3 w-3" /></a> : null}
              </span>
            </span>
          </Panel>
        )) : <InlineState label={t("No notices in this category right now.")} />}
        {explainError ? <InlineState label={explainError} tone="danger" /> : null}
        {explainer ? (
          <Panel className="border-brand-100 bg-brand-50">
            <h2 className="text-sm font-bold text-brand-900">{t("Notice explainer")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">{explainer.summary}</p>
            <div className="mt-3 space-y-1">
              {explainer.action_required.map((item) => <p key={item} className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Check className="h-3 w-3 text-trust" />{item}</p>)}
            </div>
          </Panel>
        ) : null}
        <Button variant="outline" className="w-full" onClick={noticesResource.reload}>{t("Refresh Notices")}</Button>
      </div>
      <BottomNav />
    </PhoneFrame>
  );
}

export function DarkChatScreen() {
  return (
    <PhoneFrame dark wide>
      <AppHeader dark />
      <div className="flex-1 space-y-4 overflow-y-auto px-4">
        <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-md bg-brand-600 px-4 py-3 text-sm font-semibold text-white">How do I record my attendance?</div>
        <VerifiedAnswer dark />
      </div>
      <ChatInput dark />
    </PhoneFrame>
  );
}

export function ProductBoard() {
  return (
    <div className="min-h-dvh bg-slate-100 p-4">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-5 lg:flex-row">
        <BrandPanel />
        <div className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,390px),390px))] gap-5 overflow-x-auto pb-4">
          <HomeScreen />
          <ChatLanding />
          <CategoriesScreen />
          <ChatConversation />
          <ChatConversation variant="grades" />
          <StudentIdGuide />
          <UnverifiedScreen />
          <HandoffScreen />
          <LanguageScreen />
          <HistoryScreen />
          <FeedbackScreen />
          <StudentDashboard />
          <NoticesScreen />
          <DarkChatScreen />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/chat" element={<ChatLanding />} />
        <Route path="/categories" element={<CategoriesScreen />} />
        <Route path="/chat/attendance" element={<ChatConversation />} />
        <Route path="/chat/grades" element={<ChatConversation variant="grades" />} />
        <Route path="/student-id" element={<StudentIdGuide />} />
        <Route path="/unverified" element={<UnverifiedScreen />} />
        <Route path="/handoff" element={<HandoffScreen />} />
        <Route path="/language" element={<LanguageScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/feedback" element={<FeedbackScreen />} />
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/notices" element={<NoticesScreen />} />
        <Route path="/dark-chat" element={<DarkChatScreen />} />
        <Route path="*" element={<HomeScreen />} />
      </Route>
      <Route path="/board" element={<Suspense fallback={<div className="p-6 text-sm font-semibold text-slate-600">Loading product board...</div>}><ProductBoardRoute /></Suspense>} />
      <Route path="/admin" element={<Suspense fallback={<div className="p-6 text-sm font-semibold text-slate-600">Loading admin dashboard...</div>}><AdminDashboard /></Suspense>} />
    </Routes>
  );
}
