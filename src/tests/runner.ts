// In-browser test framework for Schedora
// Provides describe/it/expect APIs that run synchronously in the browser.

export type TestStatus = "pass" | "fail" | "error";

export interface TestResult {
  id: string;
  suite: string;
  suiteName: string;
  name: string;
  status: TestStatus;
  error?: string;
  duration: number;
}

export interface TestCase {
  name: string;
  fn: () => Promise<void> | void;
}

export interface TestSuite {
  id: string;
  name: string;
  type: "unit" | "integration";
  tests: TestCase[];
}

// ── Assertions ──────────────────────────────────────────────────────────────

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

function pretty(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function expect<T>(actual: T) {
  const matchers = {
    toBe(expected: T) {
      if (actual !== expected)
        throw new AssertionError(`Expected ${pretty(expected)}, got ${pretty(actual)}`);
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new AssertionError(`Expected ${pretty(expected)}, got ${pretty(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new AssertionError(`Expected truthy, got ${pretty(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new AssertionError(`Expected falsy, got ${pretty(actual)}`);
    },
    toBeNull() {
      if (actual !== null) throw new AssertionError(`Expected null, got ${pretty(actual)}`);
    },
    toBeUndefined() {
      if (actual !== undefined)
        throw new AssertionError(`Expected undefined, got ${pretty(actual)}`);
    },
    toBeInstanceOf(cls: new (...a: unknown[]) => unknown) {
      if (!(actual instanceof cls))
        throw new AssertionError(`Expected instance of ${cls.name}`);
    },
    toContain(item: unknown) {
      if (Array.isArray(actual)) {
        if (!actual.includes(item as T))
          throw new AssertionError(`Expected array to contain ${pretty(item)}`);
      } else if (typeof actual === "string") {
        if (!(actual as string).includes(item as string))
          throw new AssertionError(`Expected "${actual}" to contain "${item}"`);
      } else {
        throw new AssertionError("toContain requires array or string");
      }
    },
    toHaveLength(len: number) {
      const l = (actual as unknown as { length: number }).length;
      if (l !== len) throw new AssertionError(`Expected length ${len}, got ${l}`);
    },
    toBeGreaterThan(n: number) {
      if ((actual as number) <= n)
        throw new AssertionError(`Expected ${actual} > ${n}`);
    },
    toBeLessThan(n: number) {
      if ((actual as number) >= n)
        throw new AssertionError(`Expected ${actual} < ${n}`);
    },
    toBeGreaterThanOrEqual(n: number) {
      if ((actual as number) < n)
        throw new AssertionError(`Expected ${actual} >= ${n}`);
    },
    toMatch(pattern: RegExp) {
      if (!pattern.test(actual as string))
        throw new AssertionError(`Expected "${actual}" to match ${pattern}`);
    },
    toThrow(msgSubstring?: string) {
      if (typeof actual !== "function")
        throw new AssertionError("toThrow requires a function");
      let threw = false;
      let err: Error | null = null;
      try {
        (actual as () => void)();
      } catch (e) {
        threw = true;
        err = e as Error;
      }
      if (!threw) throw new AssertionError("Expected function to throw");
      if (msgSubstring && err && !err.message.includes(msgSubstring))
        throw new AssertionError(
          `Expected error message to contain "${msgSubstring}", got "${err?.message}"`
        );
    },
    not: {
      toBe(expected: T) {
        if (actual === expected) throw new AssertionError(`Expected NOT ${pretty(expected)}`);
      },
      toEqual(expected: unknown) {
        if (JSON.stringify(actual) === JSON.stringify(expected))
          throw new AssertionError(`Expected NOT equal to ${pretty(expected)}`);
      },
      toContain(item: unknown) {
        if (Array.isArray(actual) && actual.includes(item as T))
          throw new AssertionError(`Expected array NOT to contain ${pretty(item)}`);
        if (typeof actual === "string" && (actual as string).includes(item as string))
          throw new AssertionError(`Expected "${actual}" NOT to contain "${item}"`);
      },
      toBeNull() {
        if (actual === null) throw new AssertionError("Expected NOT null");
      },
      toBeUndefined() {
        if (actual === undefined) throw new AssertionError("Expected NOT undefined");
      },
      toBeTruthy() {
        if (actual) throw new AssertionError(`Expected falsy, got ${pretty(actual)}`);
      },
    },
  };
  return matchers;
}

// ── Runner ───────────────────────────────────────────────────────────────────

export async function runSuites(
  suites: TestSuite[],
  onProgress?: (result: TestResult) => void
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const suite of suites) {
    for (const test of suite.tests) {
      const start = performance.now();
      const id = `${suite.id}::${test.name}`;
      let result: TestResult;
      try {
        await test.fn();
        result = {
          id,
          suite: suite.id,
          suiteName: suite.name,
          name: test.name,
          status: "pass",
          duration: performance.now() - start,
        };
      } catch (e) {
        const isAssertion = e instanceof AssertionError;
        result = {
          id,
          suite: suite.id,
          suiteName: suite.name,
          name: test.name,
          status: isAssertion ? "fail" : "error",
          error: e instanceof Error ? e.message : String(e),
          duration: performance.now() - start,
        };
      }
      results.push(result);
      onProgress?.(result);
      // Yield to the event loop so the UI can update
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return results;
}
