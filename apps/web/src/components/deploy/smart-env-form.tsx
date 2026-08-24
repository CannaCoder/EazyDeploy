"use client";

import React, { useState } from "react";
import { KeyRound, Sparkles, Clipboard, Check, AlertCircle, HelpCircle, FileText } from "lucide-react";
import { Button, Badge } from "@shipora/ui";
import { parseRawEnv } from "@shipora/code-analyzer";
import type { EnvExampleEntry } from "@shipora/types";

export interface SmartEnvFormProps {
  entries?: EnvExampleEntry[];
  initialValues?: Record<string, string>;
  onSave?: (secrets: Record<string, string>) => void;
  loading?: boolean;
}

export function SmartEnvForm({
  entries = [],
  initialValues = {},
  onSave,
  loading = false,
}: SmartEnvFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = { ...initialValues };
    entries.forEach((e) => {
      if (init[e.key] === undefined && e.defaultValue !== null) {
        init[e.key] = e.defaultValue;
      }
    });
    return init;
  });

  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState("");
  const [pastedFeedback, setPastedFeedback] = useState<string | null>(null);

  // Group entries by section
  const groups: Record<string, EnvExampleEntry[]> = {};
  entries.forEach((entry) => {
    const groupName = entry.group || "General Configuration";
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName]?.push(entry);
  });

  const handleInputChange = (key: string, val: string) => {
    // Check if user pasted a multiline KEY=val blob into an individual input
    if (val.includes("=") && val.includes("\n")) {
      handleSmartPaste(val);
      return;
    }
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSmartPaste = (pastedContent: string) => {
    const parsed = parseRawEnv(pastedContent);
    const count = Object.keys(parsed).length;
    if (count > 0) {
      setValues((prev) => ({ ...prev, ...parsed }));
      setPastedFeedback(`Auto-detected and filled ${count} environment variables!`);
      setTimeout(() => setPastedFeedback(null), 3000);
    }
  };

  const handleRawApply = () => {
    const parsed = parseRawEnv(rawText);
    setValues((prev) => ({ ...prev, ...parsed }));
    setRawMode(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave?.(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header and Smart Paste Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-violet-500/10 border border-violet-500/20 p-4 rounded-xl">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              Smart .env Auto-Detection
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Paste raw <code className="text-violet-300">KEY=val</code> pairs anywhere to auto-fill.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRawMode(!rawMode)}
          className="text-xs h-7 text-muted-foreground hover:text-white"
        >
          <FileText className="h-3 w-3 mr-1" />
          {rawMode ? "Structured View" : "Raw .env Mode"}
        </Button>
      </div>

      {pastedFeedback && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="h-4 w-4 shrink-0" />
          <span>{pastedFeedback}</span>
        </div>
      )}

      {rawMode ? (
        <div className="space-y-3">
          <label className="text-xs font-semibold text-white block">
            Paste Full .env Content:
          </label>
          <textarea
            rows={8}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="DATABASE_URL=postgres://...\nJWT_SECRET=supersecret\nPORT=3000"
            className="w-full p-3 rounded-xl bg-background border border-border text-xs text-white font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleRawApply}
            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs"
          >
            Apply & Parse
          </Button>
        </div>
      ) : (
        <div className="space-y-6 max-h-[420px] overflow-y-auto pr-1">
          {Object.keys(groups).length > 0 ? (
            Object.entries(groups).map(([groupTitle, groupEntries]) => (
              <div key={groupTitle} className="space-y-3">
                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/40 pb-1.5 flex items-center justify-between">
                  <span>{groupTitle}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/60 lowercase">
                    {groupEntries.length} vars
                  </span>
                </h5>

                <div className="grid grid-cols-1 gap-3.5">
                  {groupEntries.map((entry) => (
                    <div
                      key={entry.key}
                      className="p-3 rounded-xl bg-card/40 border border-border/40 space-y-1.5 focus-within:border-violet-500/60 focus-within:bg-card/60 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-mono font-bold text-white flex items-center gap-2">
                          <KeyRound className="h-3.5 w-3.5 text-violet-400" />
                          {entry.key}
                        </label>

                        {entry.isRequired ? (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                            Required
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground font-mono">
                            Optional
                          </Badge>
                        )}
                      </div>

                      {entry.description && (
                        <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                          <HelpCircle className="h-3 w-3 inline text-muted-foreground/60 shrink-0" />
                          {entry.description}
                        </p>
                      )}

                      <input
                        type="text"
                        value={values[entry.key] ?? ""}
                        onChange={(e) => handleInputChange(entry.key, e.target.value)}
                        placeholder={entry.defaultValue ? `Default: ${entry.defaultValue}` : "Enter value..."}
                        className="w-full h-8 px-2.5 rounded-lg bg-background/80 border border-border/80 text-xs text-white font-mono placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-xs text-muted-foreground space-y-2">
              <p>No .env.example found in repository.</p>
              <textarea
                rows={5}
                placeholder="Paste KEY=value pairs here..."
                onChange={(e) => handleSmartPaste(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-background border border-border text-xs text-white font-mono"
              />
            </div>
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="pt-4 border-t border-border/40 flex items-center justify-end gap-2">
        <Button
          type="submit"
          disabled={loading}
          className="bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs px-4"
        >
          {loading ? "Encrypting & Saving..." : "Save & Sync Secrets"}
        </Button>
      </div>
    </form>
  );
}
