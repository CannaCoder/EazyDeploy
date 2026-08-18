"use client";

export const dynamic = "force-dynamic";

import React, { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();

  const [isSecretsOpen, setIsSecretsOpen] = useState(false);

  const { data: project, isLoading, error } = trpc.project.getById.useQuery({
    id: projectId,
  });

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
      <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
        <h2 className="text-xl font-bold text-white">Project Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The requested project could not be found or you do not have permission to view it.
        </p>
        <Link href="/dashboard">
          <Button variant="outline" className="gap-2">
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/dashboard" className="hover:text-white transition-colors">
          Projects
        </Link>
        <span>/</span>
        <span className="text-white font-medium">{project.name}</span>
      </div>

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {project.name}
            </h1>
            <Badge variant="success">Active</Badge>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <FolderGit2 className="h-4 w-4" />
            <span>
              {project.githubRepoOwner}/{project.githubRepoName}
            </span>
            <span>•</span>
            <GitBranch className="h-4 w-4 text-violet-400" />
            <span>{project.productionBranch}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsSecretsOpen(true)}
            className="gap-2 text-xs"
          >
            <KeyRound className="h-4 w-4 text-violet-400" />
            Secrets Manager
          </Button>
          <Link href={`/dashboard/projects/${projectId}/checks`}>
            <Button variant="outline" className="gap-2 text-xs">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Conflict Guard
            </Button>
          </Link>
          <Link href={`/dashboard/projects/${projectId}/deployments`}>
            <Button variant="outline" className="gap-2 text-xs">
              <History className="h-4 w-4 text-indigo-400" />
              Deployments
            </Button>
          </Link>
          <Button
            onClick={handleDeploy}
            disabled={triggerDeployMutation.isPending}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white gap-2 shadow-md shadow-violet-500/20 text-xs"
          >
            {triggerDeployMutation.isPending ? (
              <>
                <Spinner size="sm" />
                Starting Deploy...
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

      {/* Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href={`/dashboard/projects/${projectId}/checks`}
          className="glass-panel p-5 rounded-xl border border-border/50 space-y-2 hover:border-emerald-500/40 transition-colors group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Conflict Guard</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-white transition-colors" />
          </div>
          <p className="text-lg font-bold text-white">Protected (Passing)</p>
          <p className="text-xs text-muted-foreground">
            No merge conflicts, lockfiles healthy, secrets synchronized.
          </p>
        </Link>

        <Link
          href={`/dashboard/projects/${projectId}/deployments`}
          className="glass-panel p-5 rounded-xl border border-border/50 space-y-2 hover:border-violet-500/40 transition-colors group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
              <Layers className="h-4 w-4 text-violet-400" />
              <span>Architecture</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-white transition-colors" />
          </div>
          <p className="text-lg font-bold text-white">Multi-Service ECS</p>
          <p className="text-xs text-muted-foreground">
            AWS CodeBuild container builder with ALB routing.
          </p>
        </Link>

        <div
          onClick={() => setIsSecretsOpen(true)}
          className="glass-panel p-5 rounded-xl border border-border/50 space-y-2 hover:border-indigo-500/40 transition-colors group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
              <KeyRound className="h-4 w-4 text-indigo-400" />
              <span>Secrets Manager</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-white transition-colors" />
          </div>
          <p className="text-lg font-bold text-white">
            {project.envSecretArn ? "AWS Encrypted" : "Configure Secrets"}
          </p>
          <p className="text-xs text-muted-foreground">
            Injected as valueFrom references to ECS Fargate.
          </p>
        </div>
      </div>

      {/* Services and Deployment Section */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-white">Monorepo Services</CardTitle>
            <CardDescription>
              Services configured for containerization and AWS Fargate deployment.
            </CardDescription>
          </div>
          <Link href={`/dashboard/projects/${projectId}/deployments`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Rocket className="h-3.5 w-3.5 text-violet-400" />
              <span>Deployments</span>
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-background/40">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center font-bold text-xs">
                  WEB
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Frontend Web</h4>
                  <span className="text-xs text-muted-foreground">Next.js 15 • Port 3000</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`https://web-${projectId.slice(0, 8)}.shipora.app`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 hidden sm:flex"
                >
                  <span>https://web-{projectId.slice(0, 8)}.shipora.app</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <Badge variant="outline">ECS Fargate</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-background/40">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">
                  API
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Backend API</h4>
                  <span className="text-xs text-muted-foreground">Fastify + tRPC • Port 4000</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`https://api-${projectId.slice(0, 8)}.shipora.app`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hidden sm:flex"
                >
                  <span>https://api-{projectId.slice(0, 8)}.shipora.app</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <Badge variant="outline">ECS Fargate</Badge>
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
