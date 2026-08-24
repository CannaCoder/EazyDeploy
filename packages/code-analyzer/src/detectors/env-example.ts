import type { EnvExampleEntry } from "@shipora/types";

/**
 * Parses .env.example content into structured entries with descriptions,
 * default values, section groups, and requirement flags.
 */
export function parseEnvExample(content: string): EnvExampleEntry[] {
  const lines = content.split("\n");
  const entries: EnvExampleEntry[] = [];
  let currentGroup: string | null = null;
  let pendingComment: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]?.trim();
    if (!rawLine) {
      pendingComment = null;
      continue;
    }

    // Comment line
    if (rawLine.startsWith("#")) {
      const commentText = rawLine.replace(/^#+[-=\s]*/, "").replace(/[-=\s]*$/, "").trim();

      // Check if this is a purely decorative line like "###" or "# ==="
      if (!commentText) {
        continue;
      }

      // Check if this looks like a section header (e.g. "# --- Database ---" or "# Authentication")
      if (
        rawLine.startsWith("# ---") ||
        rawLine.startsWith("# ===") ||
        rawLine.startsWith("###") ||
        (commentText.length > 0 && commentText.length < 30 && !commentText.includes("."))
      ) {
        currentGroup = commentText;
        pendingComment = null;
      } else {
        pendingComment = commentText;
      }
      continue;
    }


    // Key-value line
    if (rawLine.includes("=")) {
      const eqIdx = rawLine.indexOf("=");
      const key = rawLine.slice(0, eqIdx).trim();

      if (!key || !/^[A-Za-z0-9_]+$/.test(key)) {
        continue;
      }

      let rest = rawLine.slice(eqIdx + 1).trim();
      let inlineComment: string | null = null;

      // Extract inline comment if present outside of quotes
      let inSingleQuote = false;
      let inDoubleQuote = false;
      let commentIdx = -1;

      for (let c = 0; c < rest.length; c++) {
        const ch = rest[c];
        if (ch === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
        else if (ch === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
        else if (ch === "#" && !inSingleQuote && !inDoubleQuote) {
          commentIdx = c;
          break;
        }
      }

      if (commentIdx !== -1) {
        inlineComment = rest.slice(commentIdx + 1).trim();
        rest = rest.slice(0, commentIdx).trim();
      }

      // Strip outer quotes from value
      let defaultValue: string | null = rest;
      if (
        (defaultValue.startsWith('"') && defaultValue.endsWith('"')) ||
        (defaultValue.startsWith("'") && defaultValue.endsWith("'"))
      ) {
        defaultValue = defaultValue.slice(1, -1);
      }

      if (defaultValue === "") {
        defaultValue = null;
      }

      const description = inlineComment || pendingComment || null;
      const isRequired = defaultValue === null;

      entries.push({
        key,
        defaultValue,
        description,
        group: currentGroup,
        isRequired,
      });

      pendingComment = null;
    }
  }

  return entries;
}

/**
 * Parses raw .env string (e.g. pasted into a text area) into key-value pairs.
 */
export function parseRawEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();

    if (!key || !/^[A-Za-z0-9_]+$/.test(key)) continue;

    // Strip quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    result[key] = val;
  }

  return result;
}
