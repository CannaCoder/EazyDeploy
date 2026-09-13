"use client";


import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
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
import { DeployStatusBadge } from "../../../../../components/deploy/deploy-status-badge";
import {
  Rocket,
  GitCommit,
  GitBranch,
  ArrowLeft,
  ChevronRight,
  RotateCcw,
  Calendar,
  Layers,
} from "lucide-react";

export default function DeploymentsListPage() {
  const params = useParams();
  const projectId = (params?.id as string) || "";
  const router = useRouter();

  const { data: project } = trpc.project.getById.useQuery(
    { id: projectId },
    { enabled: !!projectId }
  );
  const {
    data: deploymentList,
    isLoading,
    refetch,
  } = trpc.deployment.list.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  const triggerMutation = trpc.deployment.trigger.useMutation({
    onSuccess: (data) => {
      if (data?.id) {
        router.push(`/dashboard/projects/${projectId}/deployments/${data.id}`);
      }
    },
  });

  const handleDeployNow = () => {
    triggerMutation.mutate({
      projectId,
      branch: project?.productionBranch || "main",
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
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
        <span className="text-white font-medium">Deployments</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Rocket className="h-7 w-7 text-violet-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Deployments
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Multi-service AWS ECS Fargate container deployments for {project?.name || "this project"}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={handleDeployNow}
            disabled={triggerMutation.isPending}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white gap-2 shadow-md shadow-violet-500/20"
          >
            {triggerMutation.isPending ? (
              <>
                <Spinner size="sm" />
                Initiating Deploy...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                Deploy Release
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Deployment List */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader>
          <CardTitle className="text-lg text-white">Deployment History</CardTitle>
          <CardDescription>
            Chronological log of container builds, ECS task updates, and ALB routing provisions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" />
            </div>
          ) : !deploymentList || deploymentList.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <Rocket className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-white">
                  No deployments yet
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Click &ldquo;Deploy Release&rdquo; above to build containers and provision your monorepo services to AWS ECS Fargate.
                </p>
              </div>
              <Button
                onClick={handleDeployNow}
                className="bg-violet-600 hover:bg-violet-500 text-white text-xs gap-2"
              >
                <Rocket className="h-3.5 w-3.5" />
                Trigger First Deploy
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {deploymentList.map((dep) => (
                <Link
                  key={dep.id}
                  href={`/dashboard/projects/${projectId}/deployments/${dep.id}`}
                  className="flex items-center justify-between p-4 hover:bg-background/40 transition-colors rounded-xl group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-background/60 border border-border/40 text-muted-foreground group-hover:text-white transition-colors">
                      <Rocket className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-white">
                          {dep.commitSha.slice(0, 7)}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <GitBranch className="h-3 w-3 text-violet-400" />
                          <span>{dep.branch}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {new Date(dep.createdAt).toLocaleString()}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <DeployStatusBadge status={dep.status} />
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
