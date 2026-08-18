import { describe, it, expect } from "vitest";
import { scanMergeConflicts } from "../scanners/merge-conflicts.js";

describe("scanMergeConflicts", () => {
  it("detects git merge conflict markers and returns line numbers", () => {
    const files = [
      {
        path: "src/index.ts",
        content: [
          'import { db } from "./db";',
          "<<<<<<< HEAD",
          'export const version = "1.0.0";',
          "=======",
          'export const version = "2.0.0";',
          ">>>>>>> branch-b",
        ].join("\n"),
      },
    ];

    const result = scanMergeConflicts(files);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.file).toBe("src/index.ts");
    expect(result.conflicts[0]?.lines).toEqual([2, 4, 6]);
  });

  it("returns hasConflicts: false for clean repositories", () => {
    const files = [
      {
        path: "src/index.ts",
        content: `
          export function hello() {
            return "world";
          }
        `,
      },
    ];

    const result = scanMergeConflicts(files);
    expect(result.hasConflicts).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });

  it("skips binary and image files", () => {
    const files = [
      {
        path: "public/logo.png",
        content: "<<<<<<< fake marker in binary stream >>>>>>>",
      },
    ];

    const result = scanMergeConflicts(files);
    expect(result.hasConflicts).toBe(false);
  });
});
