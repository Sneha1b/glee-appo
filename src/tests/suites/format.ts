import type { TestSuite } from "../runner";
import { expect } from "../runner";
import { fmtTime, fmtDate, fmtDateTime, ymd } from "@/lib/format";

export const formatSuite: TestSuite = {
  id: "format",
  name: "Unit · Format Library",
  type: "unit",
  tests: [
    // ── fmtTime ──────────────────────────────────────────────────────────────
    {
      name: "fmtTime: returns a non-empty string",
      fn() {
        expect(fmtTime("2024-01-15T14:30:00.000Z").length).toBeGreaterThan(0);
      },
    },
    {
      name: "fmtTime: includes the minute component",
      fn() {
        const r = fmtTime("2024-01-15T14:30:00.000Z");
        expect(r).toContain("30");
      },
    },
    {
      name: "fmtTime: matches time pattern HH:MM",
      fn() {
        expect(fmtTime("2024-01-15T09:05:00.000Z")).toMatch(/\d+:\d{2}/);
      },
    },
    {
      name: "fmtTime: midnight (00:00) renders without crash",
      fn() {
        const r = fmtTime("2024-01-15T00:00:00.000Z");
        expect(typeof r).toBe("string");
        expect(r.length).toBeGreaterThan(0);
      },
    },
    {
      name: "fmtTime: noon (12:00) includes 12",
      fn() {
        const r = fmtTime("2024-01-15T12:00:00.000Z");
        expect(r).toContain("12");
      },
    },

    // ── fmtDate ──────────────────────────────────────────────────────────────
    {
      name: "fmtDate: returns a non-empty string",
      fn() {
        expect(fmtDate(new Date("2024-01-15")).length).toBeGreaterThan(0);
      },
    },
    {
      name: "fmtDate: includes the day number",
      fn() {
        const r = fmtDate(new Date(2024, 0, 15));
        expect(r).toContain("15");
      },
    },
    {
      name: "fmtDate: includes a month name (not a number)",
      fn() {
        const r = fmtDate(new Date(2024, 0, 15)); // January
        // Should contain a word, not just digits
        expect(r).toMatch(/[A-Za-z]/);
      },
    },
    {
      name: "fmtDate: different months produce different strings",
      fn() {
        const jan = fmtDate(new Date(2024, 0, 1));
        const jun = fmtDate(new Date(2024, 5, 1));
        expect(jan).not.toBe(jun);
      },
    },

    // ── fmtDateTime ──────────────────────────────────────────────────────────
    {
      name: "fmtDateTime: contains the separator ·",
      fn() {
        expect(fmtDateTime("2024-01-15T14:30:00.000Z")).toContain("·");
      },
    },
    {
      name: "fmtDateTime: contains minute component",
      fn() {
        expect(fmtDateTime("2024-01-15T14:30:00.000Z")).toContain("30");
      },
    },
    {
      name: "fmtDateTime: returns longer string than fmtTime alone",
      fn() {
        const iso = "2024-06-15T10:00:00Z";
        expect(fmtDateTime(iso).length).toBeGreaterThan(fmtTime(iso).length);
      },
    },
    {
      name: "fmtDateTime: two different ISO strings produce different outputs",
      fn() {
        const a = fmtDateTime("2024-01-15T09:00:00Z");
        const b = fmtDateTime("2024-06-20T15:30:00Z");
        expect(a).not.toBe(b);
      },
    },

    // ── ymd ──────────────────────────────────────────────────────────────────
    {
      name: "ymd: formats as YYYY-MM-DD",
      fn() {
        expect(ymd(new Date(2024, 0, 15))).toBe("2024-01-15");
      },
    },
    {
      name: "ymd: pads single-digit month",
      fn() {
        expect(ymd(new Date(2024, 2, 5))).toBe("2024-03-05");
      },
    },
    {
      name: "ymd: pads single-digit day",
      fn() {
        expect(ymd(new Date(2024, 8, 3))).toBe("2024-09-03");
      },
    },
    {
      name: "ymd: handles December (month 11)",
      fn() {
        expect(ymd(new Date(2024, 11, 31))).toBe("2024-12-31");
      },
    },
    {
      name: "ymd: handles year 2000",
      fn() {
        expect(ymd(new Date(2000, 0, 1))).toBe("2000-01-01");
      },
    },
    {
      name: "ymd: output has exactly 10 characters",
      fn() {
        expect(ymd(new Date(2024, 5, 15))).toHaveLength(10);
      },
    },
    {
      name: "ymd: output matches YYYY-MM-DD regex",
      fn() {
        expect(ymd(new Date(2025, 3, 22))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      },
    },
  ],
};
