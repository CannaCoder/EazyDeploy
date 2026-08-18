"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import Link from "next/link";
import { trpc } from "../../lib/trpc";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Spinner } from "@shipora/ui";
import { Plus, GitBranch, ArrowRight, FolderGit2, CheckCircle2 } from "lucide-react";

export default function DashboardOverviewPage() {
  const { data: projects, isLoading } = trpc.project.list.useQuery();

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Projects
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your connected monorepos, check pre-deploy status, and orchestrate releases.
          </p>
        </div>

        <Link href="/dashboard/new-project">
          <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-500/20">
            <Plus className="mr-1.5 h-4 w-4" />
            Connect Repository
          </Button>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-xl border border-border/50">
          <span className="text-xs font-medium text-muted-foreground">Connected Projects</span>
          <p className="text-2xl font-bold text-white mt-1">
            {isLoading ? <Spinner size="sm" /> : projects?.length || 0}
          </p>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-border/50">
          <span className="text-xs font-medium text-muted-foreground">Conflict Guard Status</span>
          <div className="flex items-center gap-2 mt-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">All Branches Protected</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-border/50">
          <span className="text-xs font-medium text-muted-foreground">ECS Cluster Runtime</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-sm font-semibold text-white">AWS Fargate Active</span>
          </div>
        </div>
      </div>

      {/* Project Listing */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : !projects || projects.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/20 text-center py-16 px-6">
          <CardContent className="space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-violet-500/10 text-violet-400 mx-auto flex items-center justify-center">
              <FolderGit2 className="h-6 w-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-lg font-semibold text-white">No projects connected yet</h3>
              <p className="text-sm text-muted-foreground">
                Connect your GitHub repository to enable automatic service discovery and zero-conflict deploys.
              </p>
            </div>
            <Link href="/dashboard/new-project" className="inline-block pt-2">
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white">
                <Plus className="mr-2 h-4 w-4" />
                Connect Your First Project
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
              <Card className="hover:border-violet-500/50 transition-all duration-200 bg-card/60 hover:bg-card/90 cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg text-white">{project.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <span>{project.githubRepoOwner}/{project.githubRepoName}</span>
                      </CardDescription>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                  <div className="flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5 text-violet-400" />
                    <span>{project.productionBranch}</span>
                  </div>
                  <div className="flex items-center gap-1 text-violet-400 font-medium">
                    <span>Manage</span>
                    <ArrowRight className="h-3.5 w-3.5" />
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
