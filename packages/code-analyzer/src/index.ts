// @shipora/code-analyzer
// Static analysis engine for repository structure, frameworks, environment variables,
// Git merge conflicts, and lockfile consistency.

export * from "./analyzer.js";
export * from "./detectors/index.js";
export * from "./scanners/merge-conflicts.js";
export * from "./scanners/lockfile.js";
export type * from "./types.js";
