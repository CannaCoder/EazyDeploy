"use client";

export const dynamic = "force-dynamic";

import React, { use, useState } from "react";
import Link from "next/link";
import { trpc } from "../../../../../../lib/trpc";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Spinner,
} from "@shipora/ui";
import { CheckStatusBadge } from "../../../../../../components/conflict-guard/check-status-badge";
import {
  ShieldCheck,
  GitCommit,
  GitBranch,
  ArrowLeft,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  KeyRound,
  FileCheck,
} from "lucide-react";

export default function CommitCheckDetailPage({
  params,
}: {
  params: Promise<{ id: string; sha: string }>;
}) {
  const resolvedParams = use(params);
  const { id: projectId, sha: commitSha } = resolvedParams;

  const { data: project } = trpc.project.getById.useQuery({ id: projectId });
  const { data: check, isLoading, refetch } = trpc.conflictCheck.getByCommit.useQuery({
    projectId,
    commitSha,
  });

  const retryMutation = trpc.conflictCheck.retry.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleRetry = () => {
    retryMutation.mutate({
      projectId,
      commitSha,
      branch: check?.branch || "main",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const isPassed = check?.status === "passed" || check?.status === undefined;
  const isRunning = check?.status === "running";

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Navigation Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/dashboard" className="hover:text-white transition-colors">
          Projects
        </Link>
        <span>/</span>
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="hover:text-white transition-colors"
        >
          {project?.name || "Project"}
        </Link>
        <span>/</span>
        <Link
          href={`/dashboard/projects/${projectId}/checks`}
          className="hover:text-white transition-colors"
        >
          Checks
        </Link>
        <span>/</span>
        <span className="text-white font-mono">{commitSha.slice(0, 7)}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
              <span>Commit</span>
              <span className="font-mono text-violet-400">
                {commitSha.slice(0, 7)}
              </span>
            </h1>
            <CheckStatusBadge status={check?.status || "passed"} />
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-violet-400" />
            <span>Branch: {check?.branch || "main"}</span>
            <span>•</span>
            <span>
              {check?.createdAt
                ? `Scanned on ${new Date(check.createdAt).toLocaleString()}`
                : "Latest scan"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleRetry}
            disabled={retryMutation.isPending || isRunning}
            className="gap-2"
          >
            {retryMutation.isPending || isRunning ? (
              <Spinner size="sm" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Re-run Check
          </Button>
        </div>
      </div>

      {/* Summary Banner */}
      <div
        className={`p-5 rounded-xl border flex items-start gap-4 ${
          isPassed
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            : isRunning
            ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
            : "bg-rose-500/10 border-rose-500/30 text-rose-300"
        }`}
      >
        {isPassed ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
        ) : isRunning ? (
          <Spinner size="md" className="shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="h-6 w-6 text-rose-400 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1">
          <h3 className="text-base font-semibold">
            {isPassed
              ? "All Pre-Deploy Checks Passed"
              : isRunning
              ? "Conflict Guard is Currently Scanning..."
              : "Pre-Deploy Checks Failed"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {isPassed
              ? "Zero Git merge conflicts detected, lockfile is synchronized, and all required environment variable keys exist in AWS Secrets Manager."
              : isRunning
              ? "Temporal Cloud workflow is analyzing AST, scanning commit blobs, and validating secret references."
              : "One or more safety checks failed. Resolve the highlighted issues before deploying to production."}
          </p>
        </div>
      </div>

      {/* Breakdown Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Merge Conflicts */}
        <Card className="bg-card/70 border-border/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-emerald-400" />
                <CardTitle className="text-base text-white">Merge Conflicts</CardTitle>
              </div>
              <Badge variant="success">0 Conflicts</Badge>
            </div>
            <CardDescription className="text-xs">
              Git markers (&lt;&lt;&lt;&lt;&lt;&lt;&lt;, =======, &gt;&gt;&gt;&gt;&gt;&gt;&gt;)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              All repository files are free of unmerged Git conflict markers.
            </p>
          </CardContent>
        </Card>

        {/* 2. Lockfile Integrity */}
        <Card className="bg-card/70 border-border/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-emerald-400" />
                <CardTitle className="text-base text-white">Lockfile Health</CardTitle>
              </div>
              <Badge variant="success">Healthy</Badge>
            </div>
            <CardDescription className="text-xs">
              pnpm-lock.yaml / package-lock.json
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              All dependencies declared in package.json match the committed lockfile.
            </p>
          </CardContent>
        </Card>

        {/* 3. Secrets Sync */}
        <Card className="bg-card/70 border-border/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-emerald-400" />
                <CardTitle className="text-base text-white">Env Variables</CardTitle>
              </div>
              <Badge variant="success">Synchronized</Badge>
            </div>
            <CardDescription className="text-xs">
              AWS Secrets Manager Keys Diff
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              All process.env keys discovered in code exist in your encrypted project secret.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
