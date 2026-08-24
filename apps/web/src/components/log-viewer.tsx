"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Terminal, Download, Search, AlertTriangle, Radio } from "lucide-react";
import { Badge } from "@shipora/ui";

export interface LogLine {
  serviceName: string;
  logLine: string;
  level: "info" | "warn" | "error";
  timestamp?: string;
}

interface LogViewerProps {
  deploymentId: string;
  /** If true, connects to SSE and streams live. If false, renders initialLogs only. */
  isLive?: boolean;
  initialLogs?: LogLine[];
  /** API base URL — defaults to NEXT_PUBLIC_API_URL */
  apiUrl?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  error: "text-zinc-200 font-bold",
  warn: "text-zinc-300 font-medium",
  info: "text-zinc-400",
};

const SERVICE_COLORS = [
  "text-white",
  "text-zinc-300",
  "text-zinc-400",
  "text-zinc-500",
];

function getServiceColor(name: string, index: number): string {
  return SERVICE_COLORS[index % SERVICE_COLORS.length] ?? "text-zinc-400";
}

export function LogViewer({
  deploymentId,
  isLive = true,
  initialLogs = [],
  apiUrl,
}: LogViewerProps) {
  const [logs, setLogs] = useState<LogLine[]>(initialLogs);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [errorOnly, setErrorOnly] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isDone, setIsDone] = useState(!isLive);
  const [connected, setConnected] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Derive unique service names
  const services = Array.from(new Set(logs.map((l) => l.serviceName))).filter(
    (s) => s !== "system"
  );

  // ── SSE Connection ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLive || isDone) return;

    const base = apiUrl || "";
    const url = `${base}/deployments/${deploymentId}/logs`;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LogLine & { done?: boolean };
        if (data.done) {
          setIsDone(true);
          setConnected(false);
          es.close();
          return;
        }
        setLogs((prev) => [...prev, data]);
      } catch {
        // ignore malformed frames
      }
    };

    es.addEventListener("done", () => {
      setIsDone(true);
      setConnected(false);
      es.close();
    });

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [deploymentId, isLive, isDone, apiUrl]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(isAtBottom);
  }, []);

  // ── Derived log list ───────────────────────────────────────────────────────
  const filtered = logs.filter((l) => {
    if (activeTab !== "all" && l.serviceName !== activeTab) return false;
    if (errorOnly && l.level !== "error" && l.level !== "warn") return false;
    if (search && !l.logLine.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;

  // ── Download ───────────────────────────────────────────────────────────────
  const handleDownload = () => {
    const text = logs
      .map((l) => `[${l.timestamp ?? ""}] [${l.level.toUpperCase()}] [${l.serviceName}] ${l.logLine}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deployment-${deploymentId.slice(0, 8)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border border-white/[0.08] overflow-hidden bg-black font-mono text-xs flex flex-col shadow-xl">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-white/[0.08] bg-[#09090b]">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-zinc-300" />
          <span className="text-zinc-300 text-[11px] uppercase tracking-wider font-semibold font-mono">
            Deploy Logs
          </span>
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-white animate-pulse" : "bg-zinc-600"}`} />
              <span>{connected ? "LIVE" : isDone ? "COMPLETE" : "CONNECTING"}</span>
            </span>
          )}
          {errorCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-mono">
              {errorCount} error{errorCount > 1 ? "s" : ""}
            </Badge>
          )}
          {warnCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono text-zinc-400">
              {warnCount} warn{warnCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter logs..."
              className="bg-black border border-white/10 rounded pl-6 pr-2 py-1 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/30 w-32 font-mono"
            />
          </div>

          {/* Errors only toggle */}
          <button
            onClick={() => setErrorOnly((v) => !v)}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors font-mono ${
              errorOnly
                ? "bg-white/10 border-white/30 text-white"
                : "border-white/[0.06] text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>Errors</span>
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            title="Download log file"
            className="text-zinc-500 hover:text-white transition-colors p-1"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Service Tabs ── */}
      {services.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-white/[0.04] bg-[#09090b]">
          {["all", ...services].map((svc, i) => (
            <button
              key={svc}
              onClick={() => setActiveTab(svc)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wide transition-colors ${
                activeTab === svc
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              {svc === "all" ? "All" : (
                <span className={getServiceColor(svc, i - 1)}>{svc}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Log Lines ── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-80 overflow-y-auto p-4 space-y-0.5 scrollbar-thin bg-black select-text"
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-[11px] font-mono">
            {isLive && !isDone ? "Waiting for logs..." : "No logs to display."}
          </div>
        ) : (
          filtered.map((line, idx) => (
            <div key={idx} className="flex items-start gap-2 leading-5 group font-mono text-xs">
              {/* Timestamp */}
              {line.timestamp && (
                <span className="text-zinc-600 shrink-0 text-[10px] pt-px">
                  {new Date(line.timestamp).toISOString().slice(11, 19)}
                </span>
              )}
              {/* Service tag */}
              <span
                className={`shrink-0 text-[10px] pt-px font-semibold ${
                  getServiceColor(line.serviceName, services.indexOf(line.serviceName))
                }`}
              >
                [{line.serviceName}]
              </span>
              {/* Log line */}
              <span
                className={`break-all ${LEVEL_COLORS[line.level] ?? "text-zinc-300"}`}
                dangerouslySetInnerHTML={{
                  __html: sanitizeLogLine(line.logLine),
                }}
              />
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Jump to bottom ── */}
      {!autoScroll && (
        <div className="border-t border-white/[0.04] bg-[#09090b] flex justify-center py-1.5">
          <button
            onClick={() => {
              setAutoScroll(true);
              bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-[10px] text-zinc-400 hover:text-white transition-colors font-mono"
          >
            ↓ Jump to bottom
          </button>
        </div>
      )}
    </div>
  );
}

// Basic ANSI → HTML conversion for common color codes, no deps needed
function sanitizeLogLine(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\u001b\[1m(.*?)\u001b\[0m/g, "<strong>$1</strong>")
    .replace(/\u001b\[[0-9;]*m/g, "");
}
