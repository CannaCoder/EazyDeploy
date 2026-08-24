"use client";

import React from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Box,
  KeyRound,
  Server,
  Network,
  Rocket,
  AlertTriangle,
} from "lucide-react";
import { Spinner, Badge } from "@shipora/ui";

export interface ServiceDeployInfo {
  name: string;
  type?: string;
  port?: number;
  stage?: string;
  imageUri?: string;
  taskDefinitionArn?: string;
  serviceUrl?: string;
  error?: string;
}

export interface DeployProgressProps {
  stage:
    | "initializing"
    | "analyzing"
    | "building"
    | "syncing_secrets"
    | "provisioning"
    | "routing"
    | "completed"
    | "failed"
    | string;
  percent?: number;
  currentStep?: string;
  provider?: "aws" | "azure" | string;
  services?: ServiceDeployInfo[];
  deployedUrls?: Record<string, string>;
  error?: string;
}

function getStagesForProvider(provider?: string) {
  const p = (provider || "aws").toLowerCase();
  const isAzure = p === "azure";

  return [
    {
      key: "analyzing",
      label: "Service Discovery",
      description: "Detect monorepo services & build commands",
      icon: Layers,
    },
    {
      key: "building",
      label: isAzure ? "ACR Container Builds" : "CodeBuild Docker Builds",
      description: isAzure
        ? "Parallel container builds pushed to Azure ACR"
        : "Parallel container builds pushed to AWS ECR",
      icon: Box,
    },
    {
      key: "syncing_secrets",
      label: "Secret Slicing",
      description: isAzure
        ? "Inject Azure Key Vault secret references"
        : "Inject AWS Secrets Manager valueFrom refs",
      icon: KeyRound,
    },
    {
      key: "provisioning",
      label: isAzure ? "Container Apps Provisioning" : "ECS Fargate Provisioning",
      description: isAzure
        ? "Deploy Azure Container Apps & revisions"
        : "Register task defs and scale ECS services",
      icon: Server,
    },
    {
      key: "routing",
      label: isAzure ? "HTTPS Ingress Routing" : "ALB Subdomain Routing",
      description: isAzure
        ? "Configure Container Apps FQDN & TLS endpoints"
        : "Configure Target Groups & Listener Rules",
      icon: Network,
    },
    {
      key: "completed",
      label: "Live & Deployed",
      description: "All services online and healthy",
      icon: Rocket,
    },
  ];
}


function getStageIndex(stage: string): number {
  switch (stage) {
    case "initializing":
      return 0;
    case "analyzing":
      return 0;
    case "building":
      return 1;
    case "syncing_secrets":
      return 2;
    case "provisioning":
      return 3;
    case "routing":
      return 4;
    case "completed":
      return 5;
    case "failed":
      return -1;
    default:
      return 0;
  }
}

export function DeployProgressStepper({
  stage,
  percent,
  currentStep,
  provider = "aws",
  services,
  deployedUrls,
  error,
}: DeployProgressProps) {
  const isFailed = stage === "failed";
  const isCompleted = stage === "completed";
  const stages = getStagesForProvider(provider);
  const currentIndex = getStageIndex(stage);
  const calculatedPercent =
    percent ?? (isCompleted ? 100 : isFailed ? 100 : Math.max(10, currentIndex * 20));

  const providerName = provider.toUpperCase();

  return (
    <div className="space-y-6">
      {/* Progress Bar Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : isFailed ? (
                <XCircle className="h-4 w-4 text-rose-400" />
              ) : (
                <Spinner size="sm" />
              )}
              {isCompleted
                ? "Deployment Complete"
                : isFailed
                ? "Deployment Failed"
                : `Deploying Services to ${providerName}`}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase font-mono">
              {providerName}
            </Badge>
          </div>
          <span className="font-mono text-xs text-muted-foreground font-medium">
            {calculatedPercent}%
          </span>
        </div>

        {/* Animated Gradient Bar */}
        <div className="h-2 w-full bg-background/80 rounded-full overflow-hidden border border-border/40 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isFailed
                ? "bg-rose-500"
                : isCompleted
                ? "bg-gradient-to-r from-violet-500 via-indigo-500 to-emerald-400"
                : "bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-400 animate-pulse"
            }`}
            style={{ width: `${calculatedPercent}%` }}
          />
        </div>

        {currentStep && (
          <p className="text-xs text-muted-foreground italic pt-1">{currentStep}</p>
        )}
      </div>

      {/* Stepper Timeline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stages.map((s, idx) => {
          const Icon = s.icon;
          const isDone = isCompleted || (!isFailed && currentIndex > idx);
          const isCurrent = !isCompleted && !isFailed && currentIndex === idx;
          const isStepFailed = isFailed && currentIndex === idx;


          return (
            <div
              key={s.key}
              className={`p-4 rounded-xl border transition-all ${
                isDone
                  ? "bg-emerald-500/5 border-emerald-500/30 text-white"
                  : isCurrent
                  ? "bg-violet-500/10 border-violet-500/50 text-white shadow-lg shadow-violet-500/5 ring-1 ring-violet-500/30"
                  : isStepFailed
                  ? "bg-rose-500/10 border-rose-500/40 text-white"
                  : "bg-card/40 border-border/40 text-muted-foreground opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`p-2 rounded-lg ${
                    isDone
                      ? "bg-emerald-500/20 text-emerald-400"
                      : isCurrent
                      ? "bg-violet-500/20 text-violet-400 animate-pulse"
                      : isStepFailed
                      ? "bg-rose-500/20 text-rose-400"
                      : "bg-background/60 text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : isCurrent ? (
                  <Spinner size="sm" />
                ) : isStepFailed ? (
                  <XCircle className="h-4 w-4 text-rose-400" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground/40" />
                )}
              </div>

              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-white tracking-tight">
                  {s.label}
                </h4>
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  {s.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Alert Box */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-1">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
            <AlertTriangle className="h-4 w-4" />
            <span>Failure Details</span>
          </div>
          <p className="text-xs text-rose-300 font-mono break-all">{error}</p>
        </div>
      )}

      {/* Live Services Section */}
      {services && services.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Monorepo Services ({services.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {services.map((svc) => {
              const url = svc.serviceUrl || (deployedUrls && deployedUrls[svc.name]);
              return (
                <div
                  key={svc.name}
                  className="p-3.5 rounded-xl border border-border/50 bg-background/50 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center font-bold text-xs">
                        {svc.name.slice(0, 3).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">
                          {svc.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {svc.type || "Service"} {svc.port ? `• Port ${svc.port}` : ""}
                        </span>
                      </div>
                    </div>

                    <Badge
                      variant={
                        url
                          ? "success"
                          : svc.stage === "failed"
                          ? "destructive"
                          : "outline"
                      }
                      className="text-[10px]"
                    >
                      {url ? "Live" : svc.stage || "ECS Fargate"}
                    </Badge>
                  </div>

                  {url && (
                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Endpoint:</span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-violet-400 hover:text-violet-300 hover:underline text-[11px] truncate max-w-[220px]"
                      >
                        {url}
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
