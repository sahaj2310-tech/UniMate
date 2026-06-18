/**
 * Centralized UNIMATE University service link configuration.
 *
 * These are the single source of truth for every outbound link the chatbot,
 * quick actions, and navigation use. Until official app deep links / internal
 * APIs are provided, services point at public UNIMATE pages and are marked with
 * `temporary: true`. To enable a real integration later, replace `url` (and/or
 * add `appUrl` for a mobile deep link) and set `temporary: false`.
 */

export type UniversityServiceKey =
  | "mainWebsite"
  | "studentPortal"
  | "lms"
  | "library"
  | "academicCalendar"
  | "admissions"
  | "internationalOffice"
  | "dormitory"
  | "scholarships"
  | "campusMap"
  | "departments"
  | "notices"
  | "contact";

export type UniversityService = {
  key: UniversityServiceKey;
  /** Short human label used on buttons and cards. */
  label: string;
  /** Web URL opened today. Replace with the official page when available. */
  url: string;
  /**
   * Optional native app deep link for a future official UNIMATE app.
   * When present, clients may prefer this over `url` on supported devices.
   */
  appUrl?: string;
  /** One-line description shown under the label. */
  description: string;
  /**
   * True while this points at a generic/public page instead of the real
   * service. Surfaced to the user as a "temporary link" note.
   */
  temporary: boolean;
  /** Keywords used to detect this service from a free-text user request. */
  keywords: string[];
};

const UNIMATE_MAIN = "https://www.unimate.example.edu";
const UNIMATE_EN = "https://www.unimate.example.edu";
const UNIMATE_INTL = "https://intl.unimate.example.edu";

export const universityLinks: Record<UniversityServiceKey, UniversityService> = {
  mainWebsite: {
    key: "mainWebsite",
    label: "UNIMATE University",
    url: UNIMATE_MAIN,
    description: "Official UNIMATE University website.",
    temporary: false,
    keywords: ["unimate website", "main website", "university website", "campus website", "homepage", "official site"]
  },
  studentPortal: {
    key: "studentPortal",
    label: "Student Portal",
    url: UNIMATE_MAIN,
    description: "Smart Campus student portal for records, registration, and services.",
    temporary: true,
    keywords: ["student portal", "smart campus", "portal", "my page", "mypage", "student system"]
  },
  lms: {
    key: "lms",
    label: "LMS",
    url: UNIMATE_MAIN,
    description: "Learning Management System for courses, lectures, and assignments.",
    temporary: true,
    keywords: ["lms", "learning management", "e-learning", "elearning", "online class", "course site", "assignments"]
  },
  library: {
    key: "library",
    label: "Library",
    url: UNIMATE_EN,
    description: "Library hours, catalog, digital resources, and study rooms.",
    temporary: true,
    keywords: ["library", "book", "books", "study room", "catalog", "borrow"]
  },
  academicCalendar: {
    key: "academicCalendar",
    label: "Academic Calendar",
    url: `${UNIMATE_EN}/page/index.jsp?code=eng0206`,
    description: "Semester dates, exam periods, holidays, and key academic deadlines.",
    temporary: true,
    keywords: ["academic calendar", "calendar", "semester dates", "exam period", "schedule", "reading week", "holiday"]
  },
  admissions: {
    key: "admissions",
    label: "Admissions",
    url: UNIMATE_INTL,
    description: "Application requirements, documents, and admission inquiries.",
    temporary: true,
    keywords: ["admission", "admissions", "apply", "application", "enroll", "entrance"]
  },
  internationalOffice: {
    key: "internationalOffice",
    label: "International Office",
    url: UNIMATE_INTL,
    description: "Visa/ARC, exchange, arrival, and international student support.",
    temporary: false,
    keywords: ["international office", "international affairs", "visa", "arc", "exchange", "iac", "foreign student"]
  },
  dormitory: {
    key: "dormitory",
    label: "Dormitory & Housing",
    url: UNIMATE_EN,
    description: "Dormitory application, check-in, rules, and housing guidance.",
    temporary: true,
    keywords: ["dorm", "dormitory", "housing", "residence", "accommodation", "check-in"]
  },
  scholarships: {
    key: "scholarships",
    label: "Scholarships",
    url: UNIMATE_EN,
    description: "Scholarship eligibility, application periods, and documents.",
    temporary: true,
    keywords: ["scholarship", "scholarships", "financial aid", "grant", "tuition support"]
  },
  campusMap: {
    key: "campusMap",
    label: "Campus Map",
    url: UNIMATE_EN,
    description: "Buildings, offices, facilities, and how to find your way around.",
    temporary: true,
    keywords: ["campus map", "map", "building", "where is", "directions", "location", "find"]
  },
  departments: {
    key: "departments",
    label: "Departments & Colleges",
    url: UNIMATE_EN,
    description: "Colleges, departments, and program pages.",
    temporary: true,
    keywords: ["department", "departments", "college", "major", "faculty", "program"]
  },
  notices: {
    key: "notices",
    label: "Notices & Announcements",
    url: UNIMATE_EN,
    description: "Official notices, announcements, and updates.",
    temporary: true,
    keywords: ["notice", "notices", "announcement", "announcements", "news", "bulletin"]
  },
  contact: {
    key: "contact",
    label: "Contact & Offices",
    url: UNIMATE_EN,
    description: "Office contacts, phone numbers, and locations.",
    temporary: true,
    keywords: ["contact", "phone", "office hours", "email", "office", "reach"]
  }
};

export const universityServiceList: UniversityService[] = Object.values(universityLinks);

/** Resolve the best service deep/web link, preferring a native app link when present. */
export function resolveServiceUrl(service: UniversityService): string {
  return service.appUrl ?? service.url;
}

/**
 * Detect which university service a free-text request is asking for.
 * Returns the best keyword match, or null when nothing matches confidently.
 */
export function detectUniversityService(text: string): UniversityService | null {
  const haystack = text.toLowerCase();
  let best: { service: UniversityService; score: number } | null = null;

  for (const service of universityServiceList) {
    for (const keyword of service.keywords) {
      if (haystack.includes(keyword)) {
        // Longer keyword matches are more specific, so they win ties.
        const score = keyword.length;
        if (!best || score > best.score) {
          best = { service, score };
        }
      }
    }
  }

  return best?.service ?? null;
}
