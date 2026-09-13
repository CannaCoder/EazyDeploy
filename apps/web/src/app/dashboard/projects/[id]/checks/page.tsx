"use client";


import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { trpc } from "../../../../../lib/trpc";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Spinner,
} from "@shipora/ui";
import { CheckStatusBadge } from "../../../../../components/conflict-guard/check-status-badge";
import {
  ShieldCheck,
  GitCommit,
  GitBranch,
  ArrowLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

export default function ConflictChecksPage() {
  const params = useParams();
  const projectId = (params?.id as string) || "";

  const { data: project } = trpc.project.getById.useQuery(
    { id: projectId },
    { enabled: !!projectId }
  );
  const { data: checks, isLoading, refetch } = trpc.conflictCheck.list.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

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
        <span className="text-white font-medium">Conflict Guard Checks</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-emerald-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Conflict Guard Checks
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Automated pre-deploy safety verification history for all commits & PRs.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => refetch()}
          className="gap-2 self-start sm:self-auto"
        >
          <RotateCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Checks List */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader>
          <CardTitle className="text-lg text-white">Commit Scan History</CardTitle>
          <CardDescription>
            Every push to protected branches is analyzed for merge conflicts, lockfile integrity, and secret configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" />
            </div>
          ) : !checks || checks.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
              <p className="text-sm font-medium text-white">No checks recorded yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Push a commit or open a Pull Request to your connected GitHub repository to run your first automated check.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {checks.map((check) => (
                <Link
                  key={check.id}
                  href={`/dashboard/projects/${projectId}/checks/${check.commitSha}`}
                  className="flex items-center justify-between p-4 hover:bg-background/40 transition-colors rounded-xl group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-background/60 border border-border/40 text-muted-foreground group-hover:text-white transition-colors">
                      <GitCommit className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-white">
                          {check.commitSha.slice(0, 7)}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <GitBranch className="h-3 w-3 text-violet-400" />
                          <span>{check.branch}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Scanned {new Date(check.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <CheckStatusBadge status={check.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-white transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
