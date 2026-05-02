import type { TestSuite } from "../runner";
import { expect } from "../runner";
import { cn } from "@/lib/utils";

export const utilsSuite: TestSuite = {
  id: "utils",
  name: "Unit · Utils Library (cn)",
  type: "unit",
  tests: [
    {
      name: "cn: merges two simple class strings",
      fn() {
        expect(cn("foo", "bar")).toBe("foo bar");
      },
    },
    {
      name: "cn: returns empty string with no arguments",
      fn() {
        expect(cn()).toBe("");
      },
    },
    {
      name: "cn: handles undefined gracefully",
      fn() {
        const r = cn("base", undefined);
        expect(r).toContain("base");
      },
    },
    {
      name: "cn: handles null gracefully",
      fn() {
        const r = cn("base", null as unknown as string);
        expect(r).toContain("base");
      },
    },
    {
      name: "cn: truthy conditional class is included",
      fn() {
        const r = cn("base", true && "active");
        expect(r).toContain("active");
      },
    },
    {
      name: "cn: falsy conditional class is excluded",
      fn() {
        const r = cn("base", false && "inactive");
        expect(r).not.toContain("inactive");
      },
    },
    {
      name: "cn: resolves Tailwind padding conflict (last wins)",
      fn() {
        const r = cn("px-4", "px-6");
        expect(r).toBe("px-6");
        expect(r).not.toContain("px-4");
      },
    },
    {
      name: "cn: resolves Tailwind text-color conflict",
      fn() {
        const r = cn("text-red-500", "text-blue-500");
        expect(r).toBe("text-blue-500");
        expect(r).not.toContain("text-red-500");
      },
    },
    {
      name: "cn: resolves Tailwind margin conflict",
      fn() {
        const r = cn("mt-2", "mt-4");
        expect(r).toBe("mt-4");
        expect(r).not.toContain("mt-2");
      },
    },
    {
      name: "cn: preserves non-conflicting classes",
      fn() {
        const r = cn("flex", "items-center", "gap-2");
        expect(r).toContain("flex");
        expect(r).toContain("items-center");
        expect(r).toContain("gap-2");
      },
    },
    {
      name: "cn: handles object syntax (true key included)",
      fn() {
        const r = cn({ "font-bold": true, "font-normal": false });
        expect(r).toContain("font-bold");
        expect(r).not.toContain("font-normal");
      },
    },
    {
      name: "cn: handles array of classes",
      fn() {
        const r = cn(["flex", "items-center"], "gap-2");
        expect(r).toContain("flex");
        expect(r).toContain("items-center");
        expect(r).toContain("gap-2");
      },
    },
    {
      name: "cn: mixed object and string args",
      fn() {
        const isActive = true;
        const r = cn("btn", { "btn-active": isActive, "btn-disabled": false }, "rounded");
        expect(r).toContain("btn");
        expect(r).toContain("btn-active");
        expect(r).toContain("rounded");
        expect(r).not.toContain("btn-disabled");
      },
    },
    {
      name: "cn: resolves Tailwind background conflict",
      fn() {
        const r = cn("bg-red-500", "bg-blue-500");
        expect(r).toBe("bg-blue-500");
      },
    },
    {
      name: "cn: handles multiple conflicting utilities in sequence",
      fn() {
        const r = cn("p-2", "p-4", "p-6");
        expect(r).toBe("p-6");
      },
    },
  ],
};
