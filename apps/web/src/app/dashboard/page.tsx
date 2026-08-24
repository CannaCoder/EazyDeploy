"use client";

export const dynamic = "force-dynamic";

import React from "react";
import Link from "next/link";
import { trpc } from "../../lib/trpc";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Spinner } from "@shipora/ui";
import { Plus, GitBranch, ArrowRight, FolderGit2, CheckCircle2, Server, Activity, ShieldCheck } from "lucide-react";

export default function DashboardOverviewPage() {
  const { data: projects, isLoading } = trpc.project.list.useQuery();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
            Projects
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Connected monorepos, pre-flight conflict protection, and deployment pipelines.
          </p>
        </div>

        <Link href="/dashboard/new-project">
          <Button variant="primary" className="font-mono text-xs gap-1.5 shadow-sm">
            <Plus className="h-3.5 w-3.5" />
            <span>Connect Repository</span>
          </Button>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
        <div className="p-4 rounded border border-white/[0.08] bg-[#09090b]">
          <div className="flex items-center justify-between text-zinc-500 text-[11px]">
            <span>WORKSPACES</span>
            <FolderGit2 className="h-3.5 w-3.5 text-zinc-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-1.5">
            {isLoading ? <Spinner size="sm" /> : projects?.length || 0}
          </p>
          <span className="text-[10px] text-zinc-500 block mt-1">Turborepo & pnpm ready</span>
        </div>

        <div className="p-4 rounded border border-white/[0.08] bg-[#09090b]">
          <div className="flex items-center justify-between text-zinc-500 text-[11px]">
            <span>CONFLICT GUARD</span>
            <ShieldCheck className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            <span className="text-sm font-bold text-white">All Branches Protected</span>
          </div>
          <span className="text-[10px] text-zinc-500 block mt-1">Lockfile SHA verification active</span>
        </div>

        <div className="p-4 rounded border border-white/[0.08] bg-[#09090b]">
          <div className="flex items-center justify-between text-zinc-500 text-[11px]">
            <span>ECS RUNTIME</span>
            <Server className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            <span className="text-sm font-bold text-white">Fargate Serverless</span>
          </div>
          <span className="text-[10px] text-zinc-500 block mt-1">2-min rollback armed</span>
        </div>
      </div>

      {/* Project Listing */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : !projects || projects.length === 0 ? (
        <Card className="border-dashed border-white/10 bg-[#09090b]/50 text-center py-14 px-6">
          <CardContent className="space-y-3">
            <div className="h-10 w-10 rounded border border-white/10 bg-white/[0.03] text-white mx-auto flex items-center justify-center">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-semibold text-white font-mono">No connected repositories</h3>
              <p className="text-xs text-zinc-400">
                Connect your GitHub repository to enable automatic service discovery and zero-conflict deploys.
              </p>
            </div>
            <Link href="/dashboard/new-project" className="inline-block pt-1">
              <Button variant="primary" className="font-mono text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span>Connect First Project</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
          {projects.map((project) => (
            <Link key={project.id} href={`/dashboard/projects/${project.id}`} className="group">
              <Card className="hover:border-white/20 transition-colors bg-[#09090b] hover:bg-[#0e0e11] cursor-pointer h-full flex flex-col justify-between">
                <CardHeader className="p-4 sm:p-5 pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm sm:text-base font-mono text-white group-hover:text-zinc-200 transition-colors">
                        {project.name}
                      </CardTitle>
                      <CardDescription className="font-mono text-[11px] text-zinc-400 mt-0.5">
                        {project.githubRepoOwner}/{project.githubRepoName}
                      </CardDescription>
                    </div>
                    <Badge variant="success" dot>
                      Active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-xs font-mono text-zinc-400 pt-2 pb-4 px-4 sm:px-5 border-t border-white/[0.06]">
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    <GitBranch className="h-3 w-3 text-zinc-400" />
                    <span>{project.productionBranch}</span>
                  </div>
                  <div className="flex items-center gap-1 text-white font-medium group-hover:translate-x-0.5 transition-transform text-[11px]">
                    <span>Manage</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
