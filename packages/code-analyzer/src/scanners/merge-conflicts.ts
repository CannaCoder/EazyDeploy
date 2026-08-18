import type { MergeConflictScanResult, ConflictingFileScan, RepoFile } from "../types.js";

/**
 * Scans files for Git merge conflict markers:
 * - `<<<<<<<`
 * - `=======`
 * - `>>>>>>>`
 * - `|||||||`
 */
export function scanMergeConflicts(files: RepoFile[]): MergeConflictScanResult {
  const conflictingFiles: ConflictingFileScan[] = [];

  const conflictMarkerPrefixes = ["<<<<<<<", "=======", ">>>>>>>", "|||||||"];

  for (const file of files) {
    if (!file.content) continue;

    // Skip binary files and non-source files
    const path = file.path.toLowerCase();
    if (
      path.endsWith(".png") ||
      path.endsWith(".jpg") ||
      path.endsWith(".jpeg") ||
      path.endsWith(".gif") ||
      path.endsWith(".ico") ||
      path.endsWith(".pdf") ||
      path.endsWith(".zip") ||
      path.endsWith(".tar") ||
      path.endsWith(".gz")
    ) {
      continue;
    }

    const lines = file.content.split(/\r?\n/);
    const conflictLines: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      for (const prefix of conflictMarkerPrefixes) {
        if (line.startsWith(prefix)) {
          conflictLines.push(i + 1); // 1-indexed line number
          break;
        }
      }
    }

    if (conflictLines.length > 0) {
      conflictingFiles.push({
        file: file.path,
        lines: conflictLines,
      });
    }
  }

  return {
    hasConflicts: conflictingFiles.length > 0,
    conflicts: conflictingFiles,
  };
}
