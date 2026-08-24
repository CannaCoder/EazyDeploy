"use client";

export const dynamic = "force-dynamic";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { trpc } from "../../../../../../lib/trpc";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Spinner,
} from "@shipora/ui";
import { DeployStatusBadge } from "../../../../../../components/deploy/deploy-status-badge";
import { DeployProgressStepper } from "../../../../../../components/deploy/deploy-progress-stepper";
import { LogViewer } from "../../../../../../components/log-viewer";
import {
  Rocket,
  GitCommit,
  GitBranch,
  ArrowLeft,
  RotateCcw,
  ExternalLink,
  Layers,
  Box,
  Server,
  Globe,
  Activity,
  AlertTriangle,
  Clock,
} from "lucide-react";

const ACTIVE_STATUSES = new Set(["building", "deploying", "verifying", "rolling_back", "pending"]);

export default function DeploymentDetailsPage() {
  const params = useParams();
  const projectId = (params?.id as string) || "";
  const deploymentId = (params?.deploymentId as string) || "";
  const router = useRouter();

  const {
    data: deployment,
    isLoading,
    refetch,
  } = trpc.deployment.getById.useQuery(
    { id: deploymentId },
    {
      enabled: !!deploymentId,
      refetchInterval: (data) => {
        const status = data?.status;
        return ACTIVE_STATUSES.has(status ?? "") ? 3000 : false;
      },
    }
  );

  const rollbackMutation = trpc.deployment.rollback.useMutation({
    onSuccess: (data) => {
      if (data?.rollbackDeploymentId) {
        router.push(`/dashboard/projects/${projectId}/deployments/${data.rollbackDeploymentId}`);
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
        <h2 className="text-xl font-bold text-white">Deployment Not Found</h2>
        <p className="text-sm text-muted-foreground">
          Could not find deployment details for ID {deploymentId}.
        </p>
        <Link href={`/dashboard/projects/${projectId}/deployments`}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Deployments
          </Button>
        </Link>
      </div>
    );
  }

  const liveProgress = deployment.liveProgress;
  const stage = liveProgress?.stage || (deployment.status === "success" ? "completed" : deployment.status);
  const percent = liveProgress?.percent;
  const currentStep = liveProgress?.currentStep;

  const isAzure = deployment.project?.cloudProvider === "azure" || liveProgress?.provider === "azure";

  // Build service display list
  const servicesList =
    liveProgress?.services ||
    (deployment.services && deployment.services.length > 0
      ? deployment.services.map((s: any) => ({
          name: s.name,
          type: s.type,
          port: s.port || 3000,
          stage: deployment.status === "success" ? "success" : deployment.status,
          serviceUrl: s.serviceUrl || undefined,
        }))
      : [
          {
            name: "web",
            type: "nextjs",
            port: 3000,
            stage: deployment.status === "success" ? "success" : deployment.status,
            serviceUrl: isAzure
              ? `https://web-${projectId.slice(0, 8)}.eastus.azurecontainerapps.io`
              : `https://web-${projectId.slice(0, 8)}.shipora.app`,
          },
          {
            name: "api",
            type: "node",
            port: 4000,
            stage: deployment.status === "success" ? "success" : deployment.status,
            serviceUrl: isAzure
              ? `https://api-${projectId.slice(0, 8)}.eastus.azurecontainerapps.io`
              : `https://api-${projectId.slice(0, 8)}.shipora.app`,
          },
        ]);

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
          {deployment.project?.name || "Project"}
        </Link>
        <span>/</span>
        <Link
          href={`/dashboard/projects/${projectId}/deployments`}
          className="hover:text-white transition-colors"
        >
          Deployments
        </Link>
        <span>/</span>
        <span className="font-mono text-white font-medium">
          {deployment.commitSha.slice(0, 7)}
        </span>
      </div>

      {/* Rollback reason banner */}
      {(deployment as { rollbackReason?: string }).rollbackReason && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-300 font-mono">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span>
            {deployment.status === "rolled_back" ? "Auto-rolled back: " : "Rollback reason: "}
            {(deployment as { rollbackReason?: string }).rollbackReason}
          </span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-mono">
              Deploy #{deployment.commitSha.slice(0, 7)}
            </h1>
            <DeployStatusBadge status={deployment.status} />
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-violet-400" />
            <span>Branch: {deployment.branch}</span>
            <span>•</span>
            <span>Triggered {new Date(deployment.createdAt).toLocaleString()}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Rollback button */}
          {(deployment.status === "success" || deployment.status === "rolled_back") &&
            !!(deployment as { previousRevisionRefs?: unknown }).previousRevisionRefs &&
            rollbackMutation && (
              <Button
                variant="outline"
                onClick={() => rollbackMutation.mutate({ deploymentId })}
                disabled={rollbackMutation.isPending}
                className="gap-2 text-xs font-mono border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
              >
                {rollbackMutation.isPending ? <Spinner size="sm" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Rollback to this version
              </Button>
            )}
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Refresh
          </Button>
          <Link href={`/dashboard/projects/${projectId}/deployments`}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              All Deployments
            </Button>
          </Link>
        </div>
      </div>

      {/* Live Pipeline Stepper */}
      <Card className="bg-card/80 border-border/70 shadow-xl overflow-hidden backdrop-blur-sm">
        <CardHeader className="border-b border-border/40 bg-card/40">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Rocket className="h-5 w-5 text-violet-400" />
                <span>Deploy Engine Pipeline</span>
              </CardTitle>
              <CardDescription>
                {isAzure
                  ? "Azure ACR container build & Container Apps deployment orchestration."
                  : "AWS CodeBuild Docker container build & ECS Fargate deployment orchestration."}
              </CardDescription>
            </div>
            {deployment.temporalWorkflowId && (
              <span className="font-mono text-[11px] text-muted-foreground hidden sm:inline-block">
                Workflow: {deployment.temporalWorkflowId}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <DeployProgressStepper
            stage={stage}
            percent={percent}
            currentStep={currentStep}
            provider={isAzure ? "azure" : (deployment.project?.cloudProvider || "aws")}
            services={servicesList}
            deployedUrls={liveProgress?.deployedUrls}
            error={liveProgress?.error}
          />
        </CardContent>
      </Card>

      {/* Live Log Terminal */}
      <Card className="bg-zinc-950/70 border-white/[0.08]">
        <CardHeader className="pb-3 border-b border-white/[0.04]">
          <CardTitle className="text-sm font-mono text-white flex items-center gap-2">
            <span>Build &amp; Runtime Logs</span>
            {ACTIVE_STATUSES.has(deployment.status) && (
              <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                <Activity className="h-3 w-3 animate-pulse" />
                Live
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <LogViewer
            deploymentId={deploymentId}
            isLive={ACTIVE_STATUSES.has(deployment.status)}
          />
        </CardContent>
      </Card>

      {/* Services Endpoint Summary Card */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-400" />
            <span>Live Service Endpoints</span>
          </CardTitle>
          <CardDescription>
            {isAzure
              ? "Direct HTTPS Azure Container App endpoints provisioned for each monorepo service."
              : "Direct Application Load Balancer endpoints provisioned for each monorepo service."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servicesList.map((svc: any) => {
              const url =
                svc.serviceUrl ||
                (isAzure
                  ? `https://${svc.name}-${projectId.slice(0, 8)}.eastus.azurecontainerapps.io`
                  : `https://${svc.name}-${projectId.slice(0, 8)}.shipora.app`);
              return (
                <div
                  key={svc.name}
                  className="p-4 rounded-xl border border-border/50 bg-background/40 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center font-bold text-xs">
                        {svc.name.toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          {svc.name}
                        </h4>
                        <span className="text-xs text-muted-foreground">
                          {svc.type || "Service"} • Port {svc.port || 3000}
                        </span>
                      </div>
                    </div>
                    <DeployStatusBadge status={svc.stage || deployment.status} />
                  </div>

                  <div className="p-3 rounded-lg bg-background/80 border border-border/40 flex items-center justify-between">
                    <span className="font-mono text-xs text-violet-300 truncate max-w-[240px]">
                      {url}
                    </span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded text-muted-foreground hover:text-white hover:bg-accent/40 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
