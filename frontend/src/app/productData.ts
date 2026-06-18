import {
  BadgeCheck,
  Banknote,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  HeartPulse,
  Home,
  IdCard,
  Languages,
  Library,
  LifeBuoy,
  MapPin,
  Plane,
  ShieldCheck,
  Users
} from "lucide-react";
import { AnswerCard, Notice } from "@/types";

export type CategoryGroup = "Academics" | "Campus Life" | "Services";

export type QuickCategory = {
  icon: typeof ClipboardCheck;
  title: string;
  description: string;
  group: CategoryGroup;
};

export const quickCategories: QuickCategory[] = [
  { icon: ClipboardCheck, title: "Attendance / 출석", description: "Check-in rules, app use, and attendance support.", group: "Academics" },
  { icon: GraduationCap, title: "Grades / 성적", description: "Semester grades, grading system, and corrections.", group: "Academics" },
  { icon: IdCard, title: "Student ID / 학생증", description: "Apply, upload photo, pay fee, and pick up card.", group: "Services" },
  { icon: Banknote, title: "Tuition & Payment", description: "Payment period, scholarships, receipts, and billing.", group: "Services" },
  { icon: Home, title: "Housing", description: "Dormitory, check-in, rules, and off-campus living.", group: "Campus Life" },
  { icon: Plane, title: "Visa / ARC", description: "Arrival, ARC, extension, and immigration handoff.", group: "Services" },
  { icon: HeartPulse, title: "Health Insurance", description: "Insurance, hospitals, and emergency guidance.", group: "Services" },
  { icon: Building2, title: "Campus Facilities", description: "Buildings, offices, sports, cafeterias, and maps.", group: "Campus Life" },
  { icon: Library, title: "Library", description: "Library hours, digital services, study rooms, and rules.", group: "Campus Life" },
  { icon: LifeBuoy, title: "Counseling", description: "Student support, wellbeing, and confidential help.", group: "Campus Life" },
  { icon: BookOpen, title: "Korean Culture", description: "Etiquette, professor emails, dining, and campus manners.", group: "Campus Life" },
  { icon: MapPin, title: "Daejeon Life", description: "SIM, banking, transport, food, hospitals, and shopping.", group: "Campus Life" }
];

export const offices = [
  { icon: GraduationCap, name: "Academic Office", purpose: "Classes, grades, registration, graduation" },
  { icon: Plane, name: "International Affairs", purpose: "Visa, exchange, arrival, international support" },
  { icon: Users, name: "Student Welfare Center", purpose: "Student ID, welfare, clubs, campus life" },
  { icon: ShieldCheck, name: "IT Help Desk", purpose: "Accounts, LMS, Smart Campus, technical issues" },
  { icon: Building2, name: "Admissions Office", purpose: "Applications, documents, admission inquiries" }
];

export const notices: Notice[] = [
  { title: "System Maintenance", category: "Alert", date: "2026-05-25", description: "Smart Campus may be unavailable for a short maintenance window." },
  { title: "Scholarship Applications Open", category: "Announcement", date: "2026-05-24", description: "Review eligibility and submit documents before the posted deadline." },
  { title: "Tuition Payment Reminder", category: "Deadline", date: "2026-05-23", description: "Check the official payment notice before making a transfer." },
  { title: "Career Fair 2026", category: "Announcement", date: "2026-05-21", description: "Meet employers and prepare resumes with career support." },
  { title: "Library Schedule Change", category: "Alert", date: "2026-05-20", description: "Library hours have changed during exam preparation period." }
];

export const attendanceAnswer: AnswerCard = {
  status: "verified",
  confidence: "high",
  title: "You can record attendance using the UNIMATE Attendance App.",
  summary: "Use your UNIMATE account, choose the correct class, and check in within the allowed time.",
  steps: [
    "Open the UNIMATE Attendance App.",
    "Log in with your UNIMATE account.",
    "Select your class.",
    "Tap Check-in within the allowed time.",
    "Confirm your attendance."
  ],
  sources: [
    { title: "Student Services Info", url: "https://example.com/services", lastUpdated: "Live source" },
    { title: "Student Support Center", url: "https://example.com/support" }
  ],
  actions: ["Open Attendance App", "View English Manual", "Ask IAC"]
};

export const gradesAnswer: AnswerCard = {
  status: "verified",
  confidence: "medium",
  title: "You can view current semester grades and final grades through Smart Campus or Academic Management.",
  summary: "If a grade depends on the semester or correction period, verify the latest Academic Affairs notice.",
  sources: [
    { title: "Academic Affairs", url: "https://example.com/academics", lastUpdated: "2026 academic calendar" },
    { title: "Campus Portal Guide", url: "https://example.com/portal" }
  ],
  actions: ["Go to Grades Page", "View Academic Management", "Check grading system"]
};

export const trustPillars = [
  { icon: BadgeCheck, title: "Trusted Answers", text: "Verified with official sources you can trust." },
  { icon: Languages, title: "Multilingual Support", text: "Communicate in your preferred language." },
  { icon: Users, title: "Human Support", text: "Escalate to the right office when needed." },
  { icon: ShieldCheck, title: "Privacy First", text: "Your data is protected and never shared." }
];

export const checklistItems = [
  "Airport to Daejeon route",
  "Dormitory check-in",
  "SIM card and bank account",
  "ARC appointment preparation",
  "Health insurance and emergency contacts",
  "First-week campus orientation"
];

export const languageRows = [
  ["en", "English"],
  ["ko", "한국어 (Korean)"],
  ["hi", "हिन्दी (Hindi)"],
  ["bn", "বাংলা (Bangla)"],
  ["vi", "Tiếng Việt (Vietnamese)"],
  ["zh", "中文 (Chinese)"],
  ["ja", "日本語 (Japanese)"],
  ["ru", "Русский (Russian)"],
  ["mn", "Монгол (Mongolian)"],
  ["es", "Español (Spanish)"],
  ["fr", "Français (French)"],
  ["ms", "Bahasa Melayu (Malay)"],
  ["ta", "தமிழ் (Tamil)"],
  ["th", "ไทย (Thai)"]
];

export const adminMetrics = [
  ["Total Queries", "32,814", "+8.6%"],
  ["Verified Answers", "28,921", "+11.1%"],
  ["Escalated", "1,842", "-2.1%"],
  ["Failed Queries", "2,051", "+3.4%"],
  ["Avg Response", "3.6s", "-0.8s"]
];

export const adminTrend = [
  { day: "Mon", verified: 320, escalated: 70 },
  { day: "Tue", verified: 460, escalated: 98 },
  { day: "Wed", verified: 510, escalated: 82 },
  { day: "Thu", verified: 390, escalated: 120 },
  { day: "Fri", verified: 550, escalated: 90 },
  { day: "Sat", verified: 420, escalated: 72 },
  { day: "Sun", verified: 610, escalated: 105 }
];

export const categoryBreakdown = [
  { name: "Academics", value: 42 },
  { name: "Campus Life", value: 18 },
  { name: "Visa", value: 14 },
  { name: "Tuition", value: 9 },
  { name: "Other", value: 17 }
];
