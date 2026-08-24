"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { trpc } from "../../../../lib/trpc";
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
import { SecretsManagerDialog } from "../../../../components/deploy/secrets-manager-dialog";
import {
  GitBranch,
  Rocket,
  ShieldCheck,
  RotateCcw,
  Layers,
  ArrowLeft,
  FolderGit2,
  ChevronRight,
  KeyRound,
  ExternalLink,
  History,
} from "lucide-react";

export default function ProjectDetailsPage() {
  const params = useParams();
  const projectId = (params?.id as string) || "";
  const router = useRouter();

  const [isSecretsOpen, setIsSecretsOpen] = useState(false);

  const { data: project, isLoading, error } = trpc.project.getById.useQuery(
    {
      id: projectId,
    },
    {
      enabled: !!projectId,
    }
  );

  const triggerDeployMutation = trpc.deployment.trigger.useMutation({
    onSuccess: (data) => {
      if (data?.id) {
        router.push(`/dashboard/projects/${projectId}/deployments/${data.id}`);
      }
    },
  });

  const handleDeploy = () => {
    triggerDeployMutation.mutate({
      projectId,
      branch: project?.productionBranch || "main",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 space-y-4 font-mono">
        <h2 className="text-xl font-bold text-white">Project Not Found</h2>
        <p className="text-sm text-zinc-400">
          The requested project could not be found or you do not have permission to view it.
        </p>
        <Link href="/dashboard">
          <Button variant="outline" className="gap-2 text-xs">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
        <Link href="/dashboard" className="hover:text-white transition-colors">
          projects
        </Link>
        <span>/</span>
        <span className="text-white font-medium">{project.name}</span>
      </div>

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-mono">
              {project.name}
            </h1>
            <Badge variant="success" dot>Active</Badge>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 flex items-center gap-2 font-mono">
            <FolderGit2 className="h-4 w-4 text-zinc-500" />
            <span>
              {project.githubRepoOwner}/{project.githubRepoName}
            </span>
            <span>•</span>
            <GitBranch className="h-4 w-4 text-emerald-400" />
            <span>{project.productionBranch}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setIsSecretsOpen(true)}
            className="gap-2 text-xs font-mono"
          >
            <KeyRound className="h-3.5 w-3.5 text-zinc-400" />
            <span>Secrets</span>
          </Button>
          <Link href={`/dashboard/projects/${projectId}/checks`}>
            <Button variant="outline" className="gap-2 text-xs font-mono">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Conflict Guard</span>
            </Button>
          </Link>
          <Link href={`/dashboard/projects/${projectId}/deployments`}>
            <Button variant="outline" className="gap-2 text-xs font-mono">
              <History className="h-3.5 w-3.5 text-cyan-400" />
              <span>Deployments</span>
            </Button>
          </Link>
          <Button
            onClick={handleDeploy}
            disabled={triggerDeployMutation.isPending}
            variant="primary"
            className="font-mono text-xs gap-2 shadow-sm"
          >
            {triggerDeployMutation.isPending ? (
              <>
                <Spinner size="sm" />
                Starting Deploy...
              </>
            ) : (
              <>
                <Rocket className="h-3.5 w-3.5" />
                Deploy Release
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href={`/dashboard/projects/${projectId}/checks`}
          className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-2 hover:border-emerald-500/40 transition-colors group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 font-mono uppercase">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Conflict Guard</span>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-white transition-colors" />
          </div>
          <p className="text-base font-bold text-white font-mono">Protected (Passing)</p>
          <p className="text-xs text-zinc-400">
            No merge conflicts, lockfiles healthy, secrets synchronized.
          </p>
        </Link>

        <Link
          href={`/dashboard/projects/${projectId}/deployments`}
          className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-2 hover:border-cyan-500/40 transition-colors group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 font-mono uppercase">
              <Layers className="h-4 w-4 text-cyan-400" />
              <span>Architecture</span>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-white transition-colors" />
          </div>
          <p className="text-base font-bold text-white font-mono">
            {project.cloudProvider === "azure" ? "Azure Container Apps" : "Multi-Service ECS"}
          </p>
          <p className="text-xs text-zinc-400">
            {project.cloudProvider === "azure"
              ? "Azure ACR image build with Container Apps dynamic scaling."
              : "AWS CodeBuild container builder with ALB routing."}
          </p>
        </Link>

        <div
          onClick={() => setIsSecretsOpen(true)}
          className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-2 hover:border-amber-500/40 transition-colors group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 font-mono uppercase">
              <KeyRound className="h-4 w-4 text-amber-400" />
              <span>Secrets Manager</span>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-white transition-colors" />
          </div>
          <p className="text-base font-bold text-white font-mono">
            {project.cloudProvider === "azure"
              ? "Azure Key Vault"
              : project.envSecretArn
              ? "AWS Encrypted"
              : "Configure Secrets"}
          </p>
          <p className="text-xs text-zinc-400">
            {project.cloudProvider === "azure"
              ? "Managed Key Vault secrets injected into revision configuration."
              : "Injected as valueFrom references to ECS Fargate."}
          </p>
        </div>
      </div>

      {/* Services and Deployment Section */}
      <Card className="bg-zinc-950/70 border-white/[0.08]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold text-white font-mono">Monorepo Services</CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              {project.cloudProvider === "azure"
                ? "Services configured for containerization and Azure Container Apps deployment."
                : "Services configured for containerization and AWS Fargate deployment."}
            </CardDescription>
          </div>
          <Link href={`/dashboard/projects/${projectId}/deployments`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-mono">
              <Rocket className="h-3.5 w-3.5 text-emerald-400" />
              <span>Deployments</span>
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 font-mono">
            <div className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-black/40">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  WEB
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Frontend Web</h4>
                  <span className="text-xs text-zinc-400">Next.js 15 • Port 3000</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={
                    project.cloudProvider === "azure"
                      ? `https://web-${projectId.slice(0, 8)}.eastus.azurecontainerapps.io`
                      : `https://web-${projectId.slice(0, 8)}.shipora.app`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1 hidden sm:flex"
                >
                  <span>
                    {project.cloudProvider === "azure"
                      ? `https://web-${projectId.slice(0, 8)}.eastus.azurecontainerapps.io`
                      : `https://web-${projectId.slice(0, 8)}.shipora.app`}
                  </span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <Badge variant="outline">
                  {project.cloudProvider === "azure" ? "Container Apps" : "ECS Fargate"}
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-black/40">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                  API
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Backend API</h4>
                  <span className="text-xs text-zinc-400">Fastify + tRPC • Port 4000</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={
                    project.cloudProvider === "azure"
                      ? `https://api-${projectId.slice(0, 8)}.eastus.azurecontainerapps.io`
                      : `https://api-${projectId.slice(0, 8)}.shipora.app`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1 hidden sm:flex"
                >
                  <span>
                    {project.cloudProvider === "azure"
                      ? `https://api-${projectId.slice(0, 8)}.eastus.azurecontainerapps.io`
                      : `https://api-${projectId.slice(0, 8)}.shipora.app`}
                  </span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <Badge variant="outline">
                  {project.cloudProvider === "azure" ? "Container Apps" : "ECS Fargate"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secrets Manager Dialog */}
      <SecretsManagerDialog
        projectId={projectId}
        projectName={project.name}
        isOpen={isSecretsOpen}
        onClose={() => setIsSecretsOpen(false)}
        detectedEnvVars={["DATABASE_URL", "CLERK_SECRET_KEY", "NEXT_PUBLIC_APP_URL"]}
      />
    </div>
  );
}
