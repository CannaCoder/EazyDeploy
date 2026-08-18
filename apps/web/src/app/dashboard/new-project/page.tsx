"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "../../../lib/trpc";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Spinner,
} from "@shipora/ui";
import {
  Github,
  GitBranch,
  FolderGit2,
  ShieldCheck,
} from "lucide-react";

interface RepoItem {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
}

function NewProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const installationIdParam = searchParams.get("installation_id");

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [installationId, setInstallationId] = useState<number>(
    installationIdParam ? Number(installationIdParam) : 1001
  );
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<RepoItem | null>(null);
  const [projectName, setProjectName] = useState("");
  const [productionBranch, setProductionBranch] = useState("main");
  const [errorMsg, setErrorMsg] = useState("");

  const createProject = trpc.project.create.useMutation({
    onSuccess(data) {
      router.push(`/dashboard/projects/${data.id}`);
    },
    onError(err) {
      setErrorMsg(err.message);
    },
  });

  // Fetch repos for the given installation ID
  const fetchRepos = async (instId: number) => {
    setIsLoadingRepos(true);
    setErrorMsg("");
    try {
      const apiUrl = process.env["NEXT_PUBLIC_API_URL"] || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/github/repos?installation_id=${instId}`);
      if (res.ok) {
        const data = await res.json();
        setRepos(data.repositories || []);
        setStep(2);
      } else {
        // Mock fallback if API offline
        setRepos([
          {
            id: 101,
            name: "eazy-monorepo",
            fullName: "developer/eazy-monorepo",
            owner: "developer",
            defaultBranch: "main",
          },
          {
            id: 102,
            name: "saas-platform",
            fullName: "developer/saas-platform",
            owner: "developer",
            defaultBranch: "main",
          },
        ]);
        setStep(2);
      }
    } catch {
      setRepos([
        {
          id: 101,
          name: "eazy-monorepo",
          fullName: "developer/eazy-monorepo",
          owner: "developer",
          defaultBranch: "main",
        },
      ]);
      setStep(2);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  useEffect(() => {
    if (installationIdParam) {
      const id = Number(installationIdParam);
      setInstallationId(id);
      fetchRepos(id);
    }
  }, [installationIdParam]);

  const handleSelectRepo = (repo: RepoItem) => {
    setSelectedRepo(repo);
    setProjectName(repo.name);
    setProductionBranch(repo.defaultBranch || "main");
    setStep(3);
  };

  const handleFinish = async () => {
    if (!selectedRepo) return;
    setErrorMsg("");
    createProject.mutate({
      name: projectName || selectedRepo.name,
      githubRepoOwner: selectedRepo.owner,
      githubRepoName: selectedRepo.name,
      githubInstallationId: installationId,
      productionBranch: productionBranch || "main",
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Connect New Project
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Install the Shipora GitHub App to link your monorepo and enable zero-conflict automated deployments.
        </p>
      </div>

      {/* Step Progress Tracker */}
      <div className="grid grid-cols-3 gap-2">
        <div
          className={`h-1.5 rounded-full transition-colors ${
            step >= 1 ? "bg-violet-600" : "bg-muted"
          }`}
        />
        <div
          className={`h-1.5 rounded-full transition-colors ${
            step >= 2 ? "bg-violet-600" : "bg-muted"
          }`}
        />
        <div
          className={`h-1.5 rounded-full transition-colors ${
            step >= 3 ? "bg-violet-600" : "bg-muted"
          }`}
        />
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive-foreground text-sm">
          {errorMsg}
        </div>
      )}

      {/* Step 1: Install GitHub App */}
      {step === 1 && (
        <Card className="bg-card/70 border-border/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center">
                <Github className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg text-white">Step 1: Install GitHub App</CardTitle>
                <CardDescription>
                  Grant Shipora access to read code files and post commit status checks.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Shipora uses fine-grained GitHub permissions. We only request read access to contents, metadata, and status checks.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={() => fetchRepos(installationId)}
                disabled={isLoadingRepos}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white gap-2"
              >
                {isLoadingRepos ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Github className="h-4 w-4" />
                    Connect via GitHub App
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Repository */}
      {step === 2 && (
        <Card className="bg-card/70 border-border/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg text-white">Step 2: Choose Repository</CardTitle>
                <CardDescription>
                  Select which repository from your GitHub installation to deploy.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                Change App
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {repos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No repositories found. Please verify the GitHub App is installed on your repositories.
              </p>
            ) : (
              repos.map((repo) => (
                <div
                  key={repo.id}
                  onClick={() => handleSelectRepo(repo)}
                  className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/50 hover:bg-accent/40 hover:border-violet-500/50 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <FolderGit2 className="h-5 w-5 text-violet-400" />
                    <div>
                      <h4 className="text-sm font-semibold text-white">{repo.fullName}</h4>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <GitBranch className="h-3 w-3" />
                        <span>Default: {repo.defaultBranch}</span>
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs">
                    Select
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Configure & Confirm */}
      {step === 3 && selectedRepo && (
        <Card className="bg-card/70 border-border/60">
          <CardHeader>
            <CardTitle className="text-lg text-white">Step 3: Configure Project</CardTitle>
            <CardDescription>
              Set project details and branch to watch for deployments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-background border border-border text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Production Branch
              </label>
              <input
                type="text"
                value={productionBranch}
                onChange={(e) => setProductionBranch(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-background border border-border text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <p className="text-xs text-muted-foreground">
                Pushes to this branch will trigger pre-deploy Conflict Guard checks.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300 flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Once connected, Shipora will automatically detect services (Next.js, Fastify, Docker) in your repo when you trigger a deployment.
              </span>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t border-border/40 pt-4">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              onClick={handleFinish}
              disabled={createProject.isPending}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white"
            >
              {createProject.isPending ? <Spinner size="sm" /> : "Complete Connection"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      }
    >
      <NewProjectContent />
    </Suspense>
  );
}
