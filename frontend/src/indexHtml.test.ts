// @vitest-environment node
// "Browser opens the start page" (web-shell): the page the server delivers declares Ukrainian and a mobile viewport.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("index.html", () => {
  it("declares Ukrainian, a mobile viewport and the root element", () => {
    expect(html).toContain('<html lang="uk">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0" />');
    expect(html).toContain('<div id="root">');
  });
});
