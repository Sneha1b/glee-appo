import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { runSuites, type TestResult } from "@/tests/runner";
import { ALL_SUITES } from "@/tests/index";
import { computeCoverage, type FileCoverage } from "@/tests/coverage";

export const Route = createFileRoute("/internal/tests")({
  component: TestRunnerPage,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

type Filter = "all" | "unit" | "integration" | "fail" | "error";

function StatusIcon({ status }: { status: TestResult["status"] | "running" | "idle" }) {
  if (status === "pass")
    return <span className="inline-block size-2.5 rounded-full bg-emerald-500" title="Pass" />;
  if (status === "fail")
    return <span className="inline-block size-2.5 rounded-full bg-red-500" title="Fail" />;
  if (status === "error")
    return <span className="inline-block size-2.5 rounded-full bg-amber-500" title="Error" />;
  if (status === "running")
    return <span className="inline-block size-2.5 animate-pulse rounded-full bg-blue-400" />;
  return <span className="inline-block size-2.5 rounded-full bg-muted-foreground/30" />;
}

function CoverageBar({ pct }: { pct: number }) {
  const color =
    pct >= 90
      ? "bg-emerald-500"
      : pct >= 70
        ? "bg-blue-500"
        : pct >= 50
          ? "bg-amber-500"
          : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={`text-xs font-mono font-semibold ${pct >= 90 ? "text-emerald-500" : pct >= 70 ? "text-blue-500" : pct >= 50 ? "text-amber-500" : "text-red-500"}`}
      >
        {pct}%
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function TestRunnerPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [currentTest, setCurrentTest] = useState<string | null>(null);

  const runTests = useCallback(async () => {
    setResults([]);
    setRunning(true);
    setCurrentTest(null);

    const accumulated: TestResult[] = [];
    await runSuites(ALL_SUITES, (result) => {
      accumulated.push(result);
      setResults([...accumulated]);
      setCurrentTest(null);
    });

    setRunning(false);
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total = results.length;
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const errors = results.filter((r) => r.status === "error").length;

  const passedIds = new Set(
    results.filter((r) => r.status === "pass").map((r) => `${r.suite}::${r.name}`)
  );
  const { byFile, overall } = computeCoverage(passedIds);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const suiteTypeMap = new Map(ALL_SUITES.map((s) => [s.id, s.type]));

  const visibleResults = results.filter((r) => {
    if (filter === "fail") return r.status === "fail";
    if (filter === "error") return r.status === "error";
    if (filter === "unit") return suiteTypeMap.get(r.suite) === "unit";
    if (filter === "integration") return suiteTypeMap.get(r.suite) === "integration";
    return true;
  });

  // Group by suite
  const grouped = new Map<string, TestResult[]>();
  for (const r of visibleResults) {
    if (!grouped.has(r.suiteName)) grouped.set(r.suiteName, []);
    grouped.get(r.suiteName)!.push(r);
  }

  // ── Toggle suite expand ────────────────────────────────────────────────────
  const toggleSuite = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const hasRun = results.length > 0 || running;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Schedora · Test Runner</h1>
            <p className="text-xs text-muted-foreground">
              {ALL_SUITES.length} suites ·{" "}
              {ALL_SUITES.reduce((s, suite) => s + suite.tests.length, 0)} tests ·{" "}
              <span className="font-mono">/internal/tests</span>
            </p>
          </div>
          <button
            onClick={runTests}
            disabled={running}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {running ? (
              <>
                <span className="size-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Running…
              </>
            ) : (
              <>
                <svg
                  className="size-3.5"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M3 2.5l10 5.5-10 5.5V2.5z" />
                </svg>
                Run All Tests
              </>
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
        {/* ── Summary bar ── */}
        {hasRun && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard
              label="Total"
              value={total}
              color="text-foreground"
              sub={running ? "running…" : "complete"}
            />
            <StatCard label="Passed" value={passed} color="text-emerald-500" sub="tests" />
            <StatCard label="Failed" value={failed} color="text-red-500" sub="assertions" />
            <StatCard label="Errors" value={errors} color="text-amber-500" sub="runtime" />
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Coverage</p>
              <p className={`text-2xl font-bold font-mono ${overall >= 90 ? "text-emerald-500" : overall >= 70 ? "text-blue-500" : "text-amber-500"}`}>
                {overall}%
              </p>
              <p className="text-xs text-muted-foreground">of tracked items</p>
            </div>
          </div>
        )}

        {/* ── Progress bar ── */}
        {running && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{
                width: `${Math.round((total / ALL_SUITES.reduce((s, suite) => s + suite.tests.length, 0)) * 100)}%`,
              }}
            />
          </div>
        )}

        {/* ── Empty state ── */}
        {!hasRun && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
            <div className="mb-4 grid size-14 place-items-center rounded-full bg-muted">
              <svg className="size-6 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
            </div>
            <p className="font-medium">No tests have run yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click "Run All Tests" to execute {ALL_SUITES.reduce((s, suite) => s + suite.tests.length, 0)} tests across {ALL_SUITES.length} suites
            </p>
          </div>
        )}

        {/* ── Filters + results ── */}
        {results.length > 0 && (
          <>
            <div className="flex items-center gap-1 border-b pb-3">
              {(["all", "unit", "integration", "fail", "error"] as Filter[]).map((f) => {
                const count =
                  f === "fail"
                    ? failed
                    : f === "error"
                      ? errors
                      : f === "unit"
                        ? results.filter((r) => suiteTypeMap.get(r.suite) === "unit").length
                        : f === "integration"
                          ? results.filter((r) => suiteTypeMap.get(r.suite) === "integration").length
                          : total;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      filter === f
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {count > 0 && (
                      <span className="ml-1.5 rounded-full bg-muted/30 px-1.5 py-0.5 text-[10px] leading-none">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Suite groups */}
            <div className="space-y-2">
              {Array.from(grouped.entries()).map(([suiteName, suiteResults]) => {
                const suitePass = suiteResults.filter((r) => r.status === "pass").length;
                const suiteFail = suiteResults.filter((r) => r.status === "fail").length;
                const suiteErr = suiteResults.filter((r) => r.status === "error").length;
                const allPass = suiteFail === 0 && suiteErr === 0;
                const isOpen = expanded.has(suiteName);
                const suite = ALL_SUITES.find((s) => s.name === suiteName);

                return (
                  <div key={suiteName} className="rounded-lg border overflow-hidden">
                    <button
                      onClick={() => toggleSuite(suiteName)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition"
                    >
                      <span className="text-muted-foreground">{isOpen ? "▾" : "▸"}</span>
                      <span className="flex-1 font-medium text-sm">{suiteName}</span>
                      {suite && (
                        <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                          {suite.type}
                        </span>
                      )}
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-emerald-500 font-mono">{suitePass}</span>
                        {suiteFail > 0 && <span className="text-red-500 font-mono">{suiteFail} failed</span>}
                        {suiteErr > 0 && <span className="text-amber-500 font-mono">{suiteErr} errored</span>}
                        <span>/ {suiteResults.length}</span>
                      </span>
                      <div
                        className={`size-2.5 rounded-full ${
                          allPass ? "bg-emerald-500" : suiteFail > 0 ? "bg-red-500" : "bg-amber-500"
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="border-t divide-y bg-muted/20">
                        {suiteResults.map((r) => (
                          <div
                            key={r.id}
                            className={`flex items-start gap-3 px-4 py-2.5 text-sm ${
                              r.status !== "pass" ? "bg-red-500/5" : ""
                            }`}
                          >
                            <StatusIcon status={r.status} />
                            <span className="flex-1 text-sm">{r.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {r.duration < 1 ? "<1ms" : `${r.duration.toFixed(1)}ms`}
                            </span>
                            {r.error && (
                              <div className="mt-1 w-full col-span-full">
                                <pre className="mt-1 rounded bg-red-500/10 px-3 py-2 text-xs text-red-400 overflow-x-auto whitespace-pre-wrap">
                                  {r.status === "error" ? "RuntimeError: " : ""}
                                  {r.error}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Coverage section ── */}
        {results.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold">Coverage</h2>
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span>File</span>
                <span>Items</span>
                <span>Coverage</span>
              </div>
              {byFile.map((fc) => (
                <CoverageRow key={fc.file} fc={fc} />
              ))}
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 border-t bg-muted/50 px-4 py-3 text-sm font-semibold">
                <span>Overall</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {byFile.reduce((s, f) => s + f.covered, 0)}/
                  {byFile.reduce((s, f) => s + f.total, 0)}
                </span>
                <CoverageBar pct={overall} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Coverage tracks functions, branches, and key statements across tested source files.
              Items are marked covered when all their associated tests pass.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: number;
  color: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function CoverageRow({ fc }: { fc: FileCoverage }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid w-full grid-cols-[1fr_auto_auto] gap-x-6 border-t px-4 py-3 text-left text-sm hover:bg-muted/40 transition"
      >
        <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
          <span>{open ? "▾" : "▸"}</span>
          {fc.file}
        </span>
        <span className="font-mono text-xs text-muted-foreground self-center">
          {fc.covered}/{fc.total}
        </span>
        <CoverageBar pct={fc.pct} />
      </button>
      {open && (
        <div className="border-t bg-muted/10 px-4 py-2 space-y-1">
          {fc.items.map((item) => (
            <div key={item.name} className="flex items-center gap-2 text-xs">
              <span
                className={`size-1.5 rounded-full flex-shrink-0 ${item.covered ? "bg-emerald-500" : "bg-red-500"}`}
              />
              <span className={item.covered ? "text-foreground" : "text-muted-foreground"}>
                {item.name}
              </span>
              <span className="ml-auto text-muted-foreground/60 font-mono">{item.type}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
