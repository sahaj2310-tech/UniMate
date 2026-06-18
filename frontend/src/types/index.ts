export type Language = {
  code: string;
  nativeName: string;
  englishName: string;
};

export type Source = {
  title: string;
  url: string;
  lastUpdated?: string;
};

export type AnswerCard = {
  status: "verified" | "unverified" | "needs_handoff";
  confidence: "high" | "medium" | "low";
  title: string;
  summary: string;
  steps?: string[];
  sources: Source[];
  actions: string[];
};

export type Notice = {
  title: string;
  category: "Announcement" | "Deadline" | "Alert";
  date: string;
  description: string;
};
