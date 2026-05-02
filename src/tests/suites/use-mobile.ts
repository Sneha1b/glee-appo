// Tests for the useIsMobile hook logic.
// We test the underlying breakpoint and MediaQueryList logic directly
// since React hooks can't be called outside of components.
import type { TestSuite } from "../runner";
import { expect } from "../runner";

const MOBILE_BREAKPOINT = 768;

// Pure logic extracted from useIsMobile
function isMobileWidth(width: number): boolean {
  return width < MOBILE_BREAKPOINT;
}

function buildMediaQuery(breakpoint: number): string {
  return `(max-width: ${breakpoint - 1}px)`;
}

export const useMobileSuite: TestSuite = {
  id: "use-mobile",
  name: "Unit · useIsMobile Hook Logic",
  type: "unit",
  tests: [
    {
      name: "width < 768 is considered mobile",
      fn() {
        expect(isMobileWidth(375)).toBeTruthy();
        expect(isMobileWidth(767)).toBeTruthy();
      },
    },
    {
      name: "width === 768 is NOT mobile",
      fn() {
        expect(isMobileWidth(768)).toBeFalsy();
      },
    },
    {
      name: "width > 768 is not mobile",
      fn() {
        expect(isMobileWidth(1024)).toBeFalsy();
        expect(isMobileWidth(1440)).toBeFalsy();
      },
    },
    {
      name: "mobile breakpoint is exactly 768",
      fn() {
        expect(MOBILE_BREAKPOINT).toBe(768);
      },
    },
    {
      name: "media query string uses breakpoint - 1",
      fn() {
        expect(buildMediaQuery(768)).toBe("(max-width: 767px)");
      },
    },
    {
      name: "current window width is accessible",
      fn() {
        expect(typeof window.innerWidth).toBe("number");
        expect(window.innerWidth).toBeGreaterThan(0);
      },
    },
    {
      name: "window.matchMedia is available in browser",
      fn() {
        expect(typeof window.matchMedia).toBe("function");
      },
    },
    {
      name: "matchMedia query for mobile breakpoint returns a MediaQueryList",
      fn() {
        const mql = window.matchMedia(buildMediaQuery(768));
        expect(typeof mql.matches).toBe("boolean");
        expect(typeof mql.addEventListener).toBe("function");
        expect(typeof mql.removeEventListener).toBe("function");
      },
    },
    {
      name: "MediaQueryList.matches agrees with isMobileWidth for current viewport",
      fn() {
        const mql = window.matchMedia(buildMediaQuery(768));
        const expected = isMobileWidth(window.innerWidth);
        expect(mql.matches).toBe(expected);
      },
    },
  ],
};
