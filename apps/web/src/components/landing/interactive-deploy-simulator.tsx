"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Terminal,
  RotateCcw,
  Boxes,
  Layers,
  Copy,
  Check,
  AlertTriangle,
  Cloud,
} from "lucide-react";
import { Badge, Button } from "@shipora/ui";
import { BorderBeam } from "../ui/border-beam";

type ScenarioType = "standard" | "conflict" | "rollback";

interface LogLine {
  id: string;
  time: string;
  type: "info" | "success" | "warn" | "error" | "ast";
  text: string;
}

const SCENARIOS = {
  standard: {
    title: "Zero-Conflict Release",
    description: "Detects 3 services, verifies lockfiles, provisions ECS tasks, and shifts traffic seamlessly.",
    stages: [
      { id: "ast", label: "AST Discovery", icon: Boxes, status: "completed" },
      { id: "guard", label: "Conflict Guard", icon: ShieldCheck, status: "completed" },
      { id: "build", label: "Multi-Build", icon: Layers, status: "completed" },
      { id: "ecs", label: "ECS Canary Route", icon: Cloud, status: "completed" },
    ],
    logs: [
      { id: "1", time: "00:01", type: "info" as const, text: "$ shipora orchestrate --ref refs/heads/main --commit 8fa41b9" },
      { id: "2", time: "00:02", type: "ast" as const, text: "✔ [AST Analyzer] Parsed workspace tree: found 3 apps, 4 shared packages" },
      { id: "3", time: "00:03", type: "ast" as const, text: "  ↳ apps/web (Next.js 15 SSR, Port 3000)" },
      { id: "4", time: "00:03", type: "ast" as const, text: "  ↳ apps/api (Fastify tRPC, Port 4000)" },
      { id: "5", time: "00:04", type: "ast" as const, text: "  ↳ apps/temporal-worker (Temporal Engine, Port 7233)" },
      { id: "6", time: "00:05", type: "success" as const, text: "✔ [Conflict Guard] Lockfile hash 'pnpm-lock.yaml' verified against SHA-256" },
      { id: "7", time: "00:06", type: "success" as const, text: "✔ [Conflict Guard] Protected branch sync verified: 0 conflicting commits" },
      { id: "8", time: "00:07", type: "info" as const, text: "⚡ [Turbo Build] Matrix caching hit: packages/ui [CACHED 12ms]" },
      { id: "9", time: "00:09", type: "info" as const, text: "🐳 [Docker] Multi-stage build compiled 3 images to Amazon ECR" },
      { id: "10", time: "00:11", type: "success" as const, text: "🚀 [ECS Fargate] Registered task definition 'shipora-prod:v42'" },
      { id: "11", time: "00:12", type: "success" as const, text: "✔ [Canary Route] Health checks 200 OK. 100% traffic shifted with 0ms downtime." },
    ],
  },
  conflict: {
    title: "Conflict Guard Intercept",
    description: "Catches lockfile tampering and missing environment secrets before cloud resources are touched.",
    stages: [
      { id: "ast", label: "AST Discovery", icon: Boxes, status: "completed" },
      { id: "guard", label: "Conflict Guard", icon: AlertTriangle, status: "failed" },
      { id: "build", label: "Multi-Build", icon: Layers, status: "pending" },
      { id: "ecs", label: "ECS Canary Route", icon: Cloud, status: "pending" },
    ],
    logs: [
      { id: "1", time: "00:01", type: "info" as const, text: "$ shipora orchestrate --ref refs/heads/feature-auth --commit 3bc99d1" },
      { id: "2", time: "00:02", type: "ast" as const, text: "✔ [AST Analyzer] Discovered dependencies across 3 workspaces" },
      { id: "3", time: "00:03", type: "warn" as const, text: "⚠ [Conflict Guard] Lockfile checksum mismatch detected in apps/api/package.json" },
      { id: "4", time: "00:04", type: "error" as const, text: "✖ [Conflict Guard] MISSING_SECRET: 'DATABASE_URL' is required by packages/db" },
      { id: "5", time: "00:04", type: "error" as const, text: "🛑 [Pipeline Blocked] Deployment halted safely. 0 cloud costs incurred. 0 broken builds." },
      { id: "6", time: "00:05", type: "info" as const, text: "💡 Tip: Run `shipora env sync` or add secret in the dashboard to resolve." },
    ],
  },
  rollback: {
    title: "2-Minute Auto-Rollback",
    description: "Continuously polls post-deploy health. If 5xx errors spike, instantly shifts traffic to previous ECS task.",
    stages: [
      { id: "ast", label: "AST Discovery", icon: Boxes, status: "completed" },
      { id: "guard", label: "Conflict Guard", icon: ShieldCheck, status: "completed" },
      { id: "build", label: "Multi-Build", icon: Layers, status: "completed" },
      { id: "ecs", label: "Auto-Rollback", icon: RotateCcw, status: "completed" },
    ],
    logs: [
      { id: "1", time: "00:01", type: "info" as const, text: "$ shipora orchestrate --ref refs/heads/main --commit 91e204c" },
      { id: "2", time: "00:03", type: "success" as const, text: "✔ [Build Matrix] Built task definitions 'shipora-prod:v43'" },
      { id: "3", time: "00:06", type: "info" as const, text: "⚡ [ECS Deploy] Shifted 10% canary traffic to new task definition" },
      { id: "4", time: "00:08", type: "warn" as const, text: "⚠ [Health Monitor] Canary health check failed: HTTP 500 on /health/ready" },
      { id: "5", time: "00:09", type: "warn" as const, text: "🔄 [Auto-Rollback Triggered] Temporal workflow initiated rollback within 12 seconds" },
      { id: "6", time: "00:10", type: "success" as const, text: "✔ [Rollback Complete] Reverted traffic to pinned stable task 'shipora-prod:v42'" },
      { id: "7", time: "00:11", type: "success" as const, text: "✔ Zero downtime experienced by end users. Crash telemetry recorded." },
    ],
  },
};

export function InteractiveDeploySimulator() {
  const [scenario, setScenario] = useState<ScenarioType>("standard");
  const [displayedLogs, setDisplayedLogs] = useState<LogLine[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const activeData = SCENARIOS[scenario];

  const handleCopyLogs = () => {
    const text = displayedLogs
      .filter((l): l is LogLine => Boolean(l && l.time && l.text))
      .map((l) => `[${l.time}] ${l.text}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startSimulation = (selectedScenario: ScenarioType) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsRunning(true);
    setDisplayedLogs([]);
    setCurrentStepIdx(0);

    const logsToStream = SCENARIOS[selectedScenario]?.logs || [];
    let idx = 0;

    intervalRef.current = setInterval(() => {
      if (idx < logsToStream.length) {
        const currentLog = logsToStream[idx];
        if (currentLog) {
          setDisplayedLogs((prev) => [...prev, currentLog]);
          setCurrentStepIdx(Math.min(3, Math.floor(((idx + 1) / logsToStream.length) * 4)));
        }
        idx++;
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsRunning(false);
        setCurrentStepIdx(3);
      }
    }, 240);
  };

  useEffect(() => {
    startSimulation(scenario);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [scenario]);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollTop = terminalEndRef.current.scrollHeight;
    }
  }, [displayedLogs]);

  return (
    <div className="w-full rounded-lg border border-white/[0.08] bg-[#09090b] overflow-hidden shadow-2xl relative">
      <BorderBeam size={240} duration={14} colorFrom="rgba(255,255,255,0.25)" colorTo="transparent" />

      {/* Simulator Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/[0.08] bg-[#09090b] px-4 sm:px-6 py-3 gap-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          <h3 className="text-xs font-mono font-medium text-white">
            {activeData.title}
          </h3>
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded border border-white/10 bg-black">
          <button
            onClick={() => setScenario("standard")}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
              scenario === "standard"
                ? "bg-white text-black font-semibold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Zero-Conflict
          </button>
          <button
            onClick={() => setScenario("conflict")}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
              scenario === "conflict"
                ? "bg-white text-black font-semibold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Conflict Intercept
          </button>
          <button
            onClick={() => setScenario("rollback")}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
              scenario === "rollback"
                ? "bg-white text-black font-semibold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Auto-Rollback
          </button>
        </div>
      </div>

      {/* Stage Progression Visualizer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-4 sm:p-5 bg-black border-b border-white/[0.06]">
        {activeData.stages.map((st, idx) => {
          const Icon = st.icon;
          const isPassed = currentStepIdx >= idx && (!isRunning || currentStepIdx > idx);
          const isCurrent = currentStepIdx === idx && isRunning;
          const isFailed = st.status === "failed" && !isRunning;

          return (
            <div
              key={st.id}
              className={`p-3 rounded border transition-colors ${
                isFailed
                  ? "border-zinc-700 bg-zinc-900 text-zinc-300"
                  : isPassed
                  ? "border-white/20 bg-white/[0.05] text-white"
                  : isCurrent
                  ? "border-white/30 bg-white/[0.08] text-white"
                  : "border-white/[0.06] bg-transparent text-zinc-600"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[10px] font-mono">
                  {isFailed ? "BLOCKED" : isPassed ? "PASSED" : isCurrent ? "ACTIVE" : "QUEUED"}
                </span>
              </div>
              <p className="text-xs font-semibold font-mono truncate">{st.label}</p>
            </div>
          );
        })}
      </div>

      {/* Terminal Window Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2 bg-[#09090b] border-b border-white/[0.06] text-xs font-mono text-zinc-400">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-zinc-700" />
            <span className="h-2 w-2 rounded-full bg-zinc-700" />
            <span className="h-2 w-2 rounded-full bg-zinc-700" />
          </div>
          <span className="text-[11px] text-zinc-500 ml-2">shipora-daemon · orchestrator.log</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLogs}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
          <button
            onClick={() => startSimulation(scenario)}
            disabled={isRunning}
            className="flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white px-2 py-0.5 rounded border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors disabled:opacity-50"
          >
            <RotateCcw className={`h-3 w-3 ${isRunning ? "animate-spin" : ""}`} />
            <span>Re-run</span>
          </button>
        </div>
      </div>

      {/* Terminal Console Logs */}
      <div
        ref={terminalEndRef}
        className="p-4 sm:p-6 font-mono text-xs sm:text-[13px] leading-relaxed bg-[#000000] h-60 overflow-y-auto space-y-1.5 select-text"
      >
        {displayedLogs
          .filter((log): log is LogLine => Boolean(log && log.id))
          .map((log) => (
            <div key={log.id} className="flex items-start gap-2.5">
              <span className="text-zinc-600 text-[11px] shrink-0">{log.time || "00:00"}</span>
              <span
                className={
                  log.type === "success"
                    ? "text-white font-medium"
                    : log.type === "warn"
                    ? "text-zinc-300"
                    : log.type === "error"
                    ? "text-zinc-200 font-bold underline"
                    : log.type === "ast"
                    ? "text-zinc-300"
                    : "text-zinc-400"
                }
              >
                {log.text}
              </span>
            </div>
          ))}
        {isRunning && (
          <div className="flex items-center gap-2 text-zinc-500 pt-1 font-mono">
            <span className="inline-block h-3.5 w-1 bg-white animate-pulse" />
            <span className="text-[11px]">Executing pipeline activity...</span>
          </div>
        )}
      </div>

      {/* Scenario Footnote */}
      <div className="p-3 px-6 bg-[#09090b] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-400 font-mono">
        <span>{activeData.description}</span>
        <span className="hidden sm:inline text-zinc-600">Autonomous Execution</span>
      </div>
    </div>
  );
}
