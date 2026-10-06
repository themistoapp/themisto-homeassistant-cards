import { describe, expect, it } from "vitest";

/**
 * Keeps the cards on themisto.app's brand: every font size and box radius in a card's CSS comes
 * from the tokens in src/shared/styles.ts. A line marked "brand-exception" (the thermostat dial,
 * the heading card's page title) may use its own sizes.
 */
const files = import.meta.glob<string>(["../src/cards/*.ts", "../src/components/*.ts"], { query: "?raw", import: "default", eager: true });
const styles = Object.values(import.meta.glob<string>("../src/shared/styles.ts", { query: "?raw", import: "default", eager: true }))[0];

function offenders(re: RegExp, allowed: (match: string) => boolean) {
  const out: string[] = [];
  for (const [f, src] of Object.entries(files)) {
    // Thermostat dial block is a declared exception from its opening comment to the end of its styles.
    const lines = src.split("\n");
    let exempt = false;
    lines.forEach((line, i) => {
      if (line.includes("(brand-exception)")) exempt = true;
      if (exempt && /^\s*`,\s*$/.test(line)) exempt = false;
      if (exempt || line.includes("brand-exception")) return;
      for (const m of line.matchAll(re)) if (!allowed(m[0])) out.push(`${f}:${i + 1}  ${m[0]}`);
    });
  }
  return out;
}

describe("brand", () => {
  it("takes every font size from the type tokens", () => {
    const bad = offenders(/font(-size)?:[^;"`]*?\b\d+(\.\d+)?px/g, () => false);
    expect(bad).toEqual([]);
  });
  it("takes every box radius from the radius tokens", () => {
    const bad = offenders(/border-radius:\s*[^;"`]+/g, (m) => /var\(--tm-radius|50%|99px|999px|inherit/.test(m));
    expect(bad).toEqual([]);
  });
  it("keeps the type scale to the brand's sizes", () => {
    const sizes = [...styles.matchAll(/--tm-fs-[a-z-]+:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    // 1.7rem, 1.4rem, 1.1rem section/card titles; body; .85rem buttons; .8rem small; .7rem eyebrow; .66rem label.
    expect(sizes).toEqual([27.2, 22.4, 17.6, 14, 13.6, 12.8, 11.2, 10.6]);
  });
});
