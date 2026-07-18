import { describe, it, expect } from "vitest";
import { navItems } from "@/components/layout/nav-items";

describe("navItems", () => {
  it("has the 9 expected sections", () => {
    expect(navItems).toHaveLength(9);
  });

  it("every entry has a unique href, a label, and an icon", () => {
    const hrefs = navItems.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const item of navItems) {
      expect(item.href).toMatch(/^\//);
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon).toBeTruthy();
    }
  });
});
