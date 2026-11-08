// @vitest-environment node
// "Browser opens the start page" (web-shell): the page the server delivers declares Ukrainian and a mobile viewport.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("index.html", () => {
  it("declares Ukrainian, a mobile viewport and the root element", () => {
    expect(html).toContain('<html lang="uk">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0" />');
    expect(html).toContain('<div id="root">');
  });

  // "The icon is linked" (web-shell, compact-shell): an SVG icon, so no browser asks for /favicon.ico.
  it("links the SVG icon from the public directory", () => {
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
    const icon = new URL("../public/favicon.svg", import.meta.url);
    expect(existsSync(icon)).toBe(true);
    expect(readFileSync(icon, "utf8").startsWith("<svg")).toBe(true);
  });
});
