import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api";

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("posts chat messages with the selected language", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      answer: "Use Smart Campus.",
      confidence: "high",
      citations: [],
      related_pages: [],
      suggested_next_actions: [],
      requires_handoff: false,
      language: "en"
    }));
    vi.stubGlobal("fetch", fetchMock);

    await api.chat("Where are grades?", "en");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/chat", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ message: "Where are grades?", language: "en" })
    }));
  });

  it("adds bearer auth for admin endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      total_queries: 0,
      verified_answers: 0,
      escalated_to_human: 0,
      failed_queries: 0,
      average_response_time: "0s",
      language_usage: {}
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => "reviewer-token",
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
    });

    await api.admin.analytics();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/admin/analytics", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer reviewer-token" })
    }));
  });

  it("logs in admins with normalized credentials payload shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ access_token: "jwt", token_type: "bearer", role: "admin" }));
    vi.stubGlobal("fetch", fetchMock);

    await api.admin.login("admin@example.edu", "Passw0rd!234");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/admin/login", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "admin@example.edu", password: "Passw0rd!234" })
    }));
  });

  it("uses the bulk approval endpoint for multiple source documents", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      status: "approved",
      requested_count: 2,
      approved_count: 2,
      already_approved_count: 0,
      not_found_count: 0,
      chunks_activated_count: 4,
      approved_document_ids: [1, 2],
      already_approved_document_ids: [],
      not_found_document_ids: []
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => "reviewer-token",
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
    });

    await api.admin.approveDocuments([1, 2], "Looks official");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/admin/approve-documents", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ document_ids: [1, 2], notes: "Looks official" }),
      headers: expect.objectContaining({ Authorization: "Bearer reviewer-token" })
    }));
  });

  it("starts crawls and creates handoff tickets with expected payloads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 3, seed_url: "https://www.unimate.example.edu", status: "queued", page_limit: 20, created_at: "2026-05-25T00:00:00" }))
      .mockResolvedValueOnce(jsonResponse({ id: 9, question: "Visa help", language: "en", office_name: "International Affairs", status: "open", created_at: "2026-05-25T00:00:00" }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => "admin-token",
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
    });

    await api.admin.startCrawl("https://www.unimate.example.edu", 20);
    await api.handoffTicket({ question: "Visa help", office_name: "International Affairs" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:8000/api/admin/crawl", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ seed_url: "https://www.unimate.example.edu", page_limit: 20 })
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:8000/api/handoff-ticket", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ language: "en", question: "Visa help", office_name: "International Affairs" })
    }));
  });

  it("calls report and checklist helper endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "received" }))
      .mockResolvedValueOnce(jsonResponse({ title: "New Student Checklist", items: ["Confirm admission"] }));
    vi.stubGlobal("fetch", fetchMock);

    await api.reportAnswer({ helpful: false, reasons: ["Missing source"], comment: "Need source" });
    await api.checklist("new_student", "ko");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:8000/api/report-answer", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ helpful: false, reasons: ["Missing source"], comment: "Need source" })
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:8000/api/checklist", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ audience: "new_student", language: "ko" })
    }));
  });

  it("throws API errors with backend detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "Admin authentication required" }, { status: 401, statusText: "Unauthorized" })));

    await expect(api.admin.approveDocument(7)).rejects.toMatchObject({
      status: 401,
      message: "Admin authentication required"
    });
  });
});
