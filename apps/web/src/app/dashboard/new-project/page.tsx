"use client";


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
  Search,
  Key,
  Star,
  Lock,
  Globe,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  FileText,
  List,
  KeyRound,
} from "lucide-react";
import { CloudProviderCard } from "@/components/cloud-connect/cloud-provider-card";
import { AwsConnectWizard } from "@/components/cloud-connect/aws-connect-wizard";
import { AzureConnectWizard } from "@/components/cloud-connect/azure-connect-wizard";
import { DigitalOceanConnectWizard } from "@/components/cloud-connect/digitalocean-connect-wizard";
import { GcpConnectWizard } from "@/components/cloud-connect/gcp-connect-wizard";
import type { CloudProvider } from "@shipora/types";

interface RepoItem {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  ownerAvatar?: string;
  defaultBranch: string;
  branches?: string[];
  description?: string;
  stars?: number;
  isPrivate?: boolean;
  language?: string;
  htmlUrl?: string;
  isStatic?: boolean;
  detectedType?: string;
}

interface GitHubUser {
  login: string;
  name?: string;
  avatarUrl?: string;
}

function NewProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const installationIdParam = searchParams.get("installation_id");

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [activeTab, setActiveTab] = useState<"direct" | "token" | "app">("direct");

  // Environment variables state (Vercel style)
  const [envMode, setEnvMode] = useState<"paste" | "form">("paste");
  const [envRawText, setEnvRawText] = useState("");
  const [envVarsList, setEnvVarsList] = useState<
    Array<{ id: string; key: string; value: string; show: boolean }>
  >([{ id: "1", key: "", value: "", show: false }]);
  const [parsedEnvCount, setParsedEnvCount] = useState<number | null>(null);

  // Direct repo lookup state
  const [repoInput, setRepoInput] = useState("");
  const [personalToken, setPersonalToken] = useState("");
  const [isVerifyingRepo, setIsVerifyingRepo] = useState(false);
  const [verifiedRepo, setVerifiedRepo] = useState<RepoItem | null>(null);

  // Token / Account list state
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [userRepos, setUserRepos] = useState<RepoItem[]>([]);
  const [searchFilter, setSearchFilter] = useState("");

  // App setup info
  const [appInfo, setAppInfo] = useState<{ configured: boolean; slug: string | null; installUrl: string | null }>({
    configured: false,
    slug: null,
    installUrl: null,
  });

  // Selected project state
  const [selectedRepo, setSelectedRepo] = useState<RepoItem | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider>("azure");
  const [wizardModal, setWizardModal] = useState<CloudProvider | null>(null);
  const [projectName, setProjectName] = useState("");
  const [productionBranch, setProductionBranch] = useState("main");
  const [errorMsg, setErrorMsg] = useState("");
  const [connectedProviders, setConnectedProviders] = useState<{
    aws: boolean;
    azure: boolean;
    digitalocean: boolean;
    gcp: boolean;
  }>({
    aws: false,
    azure: true,
    digitalocean: false,
    gcp: false,
  });
  const [azureConnectionId, setAzureConnectionId] = useState<string | null>(null);
  const [awsConnectionId, setAwsConnectionId] = useState<string | null>(null);
  const [doConnectionId, setDoConnectionId] = useState<string | null>(null);
  const [gcpConnectionId, setGcpConnectionId] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const parseEnvText = (text: string) => {
    const lines = text.split("\n");
    const parsed: Array<{ id: string; key: string; value: string; show: boolean }> = [];
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].trim();
      if (!rawLine || rawLine.startsWith("#")) continue;
      const eqIndex = rawLine.indexOf("=");
      if (eqIndex === -1) continue;
      const k = rawLine.substring(0, eqIndex).trim();
      let v = rawLine.substring(eqIndex + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (k) {
        parsed.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          key: k,
          value: v,
          show: false,
        });
      }
    }
    return parsed;
  };

  const handleApplyRawEnv = () => {
    const parsed = parseEnvText(envRawText);
    if (parsed.length > 0) {
      setEnvVarsList(parsed);
      setParsedEnvCount(parsed.length);
      setEnvMode("form");
    }
  };

  const handleAddEnvRow = () => {
    setEnvVarsList((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        key: "",
        value: "",
        show: false,
      },
    ]);
  };

  const handleUpdateEnvRow = (id: string, field: "key" | "value", val: string) => {
    setEnvVarsList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  const handleToggleShow = (id: string) => {
    setEnvVarsList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, show: !item.show } : item))
    );
  };

  const handleRemoveEnvRow = (id: string) => {
    setEnvVarsList((prev) => prev.filter((item) => item.id !== id));
  };

  const getCleanEnvMap = (): Record<string, string> => {
    const map: Record<string, string> = {};
    if (envMode === "paste" && envRawText.trim()) {
      const parsed = parseEnvText(envRawText);
      for (const item of parsed) {
        if (item.key.trim()) map[item.key.trim()] = item.value;
      }
      return map;
    }
    for (const item of envVarsList) {
      const k = item.key.trim();
      if (k) {
        map[k] = item.value;
      }
    }
    return map;
  };

  const triggerDeploy = trpc.deployment.trigger.useMutation({
    onSuccess(deployData) {
      if (deployData?.projectId && deployData?.id) {
        router.push(`/dashboard/projects/${deployData.projectId}/deployments/${deployData.id}`);
      } else {
        router.push(`/dashboard/projects/${createProject.data?.id}`);
      }
    },
    onError() {
      if (createProject.data?.id) {
        router.push(`/dashboard/projects/${createProject.data.id}`);
      }
    },
  });

  const createProject = trpc.project.create.useMutation({
    onSuccess(data) {
      const envMap = getCleanEnvMap();
      triggerDeploy.mutate({
        projectId: data.id,
        branch: productionBranch || data.productionBranch || "main",
        envVars: Object.keys(envMap).length > 0 ? envMap : undefined,
      });
    },
    onError(err) {
      setErrorMsg(err.message);
    },
  });

  const handleConnectAzure = async () => {
    try {
      if (selectedRepo && typeof window !== "undefined") {
        sessionStorage.setItem("new_project_selected_repo", JSON.stringify(selectedRepo));
      }
      const targetReturn = typeof window !== "undefined" ? window.location.pathname : "/dashboard/new-project";
      const res = await fetch(`${apiUrl}/auth/azure/start?returnTo=${encodeURIComponent(targetReturn)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
          return;
        }
      }
    } catch {
      // fallback
    }
    setWizardModal("azure");
  };

  const handleConnectDigitalOcean = async () => {
    try {
      if (selectedRepo && typeof window !== "undefined") {
        sessionStorage.setItem("new_project_selected_repo", JSON.stringify(selectedRepo));
      }
      const targetReturn = typeof window !== "undefined" ? window.location.pathname : "/dashboard/new-project";
      const res = await fetch(`${apiUrl}/auth/digitalocean/start?returnTo=${encodeURIComponent(targetReturn)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
          return;
        }
      }
    } catch {
      // fallback
    }
    setWizardModal("digitalocean");
  };

  const handleConnectGcp = async () => {
    try {
      if (selectedRepo && typeof window !== "undefined") {
        sessionStorage.setItem("new_project_selected_repo", JSON.stringify(selectedRepo));
      }
      const targetReturn = typeof window !== "undefined" ? window.location.pathname : "/dashboard/new-project";
      const res = await fetch(`${apiUrl}/auth/gcp/start?returnTo=${encodeURIComponent(targetReturn)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
          return;
        }
      }
    } catch {
      // fallback
    }
    setWizardModal("gcp");
  };

  // Load connected cloud providers on mount
  useEffect(() => {
    fetch(`${apiUrl}/cloud-connect/connections`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.connections) {
          const hasAws = data.connections.some((c: any) => c.provider === "aws");
          const hasAzure = data.connections.some((c: any) => c.provider === "azure");
          const hasDo = data.connections.some((c: any) => c.provider === "digitalocean");
          const hasGcp = data.connections.some((c: any) => c.provider === "gcp");
          const azureConn = data.connections.find((c: any) => c.provider === "azure");
          const awsConn = data.connections.find((c: any) => c.provider === "aws");
          const doConn = data.connections.find((c: any) => c.provider === "digitalocean");
          const gcpConn = data.connections.find((c: any) => c.provider === "gcp");
          if (azureConn?.id) {
            setAzureConnectionId(azureConn.id);
          }
          if (awsConn?.id) {
            setAwsConnectionId(awsConn.id);
          }
          if (doConn?.id) {
            setDoConnectionId(doConn.id);
          }
          if (gcpConn?.id) {
            setGcpConnectionId(gcpConn.id);
          }
          setConnectedProviders({
            aws: !!hasAws,
            azure: !!hasAzure,
            digitalocean: !!hasDo,
            gcp: !!hasGcp,
          });
          if (hasAws && !hasAzure) {
            setSelectedProvider("aws");
          } else {
            setSelectedProvider("azure");
          }
        }
      })
      .catch(() => {});
  }, [apiUrl]);

  // Handle redirect back from OAuth
  useEffect(() => {
    const status = searchParams.get("status");
    const provider = searchParams.get("provider");
    const connId = searchParams.get("connectionId");

    if (connId) {
      if (provider === "azure") setAzureConnectionId(connId);
      if (provider === "digitalocean") setDoConnectionId(connId);
      if (provider === "gcp") setGcpConnectionId(connId);
    }

    if (status === "connected" && (provider === "azure" || provider === "digitalocean" || provider === "gcp")) {
      const p = provider as "azure" | "digitalocean" | "gcp";
      setConnectedProviders((prev) => ({ ...prev, [p]: true }));
      setSelectedProvider(p);

      // Automatically restore repo and jump directly to Step 2
      if (typeof window !== "undefined") {
        const saved = sessionStorage.getItem("new_project_selected_repo");
        if (saved) {
          try {
            const repo = JSON.parse(saved);
            setSelectedRepo(repo);
            setProjectName(repo.name);
            setProductionBranch(repo.defaultBranch || "main");
            setStep(2);
          } catch {
            // ignore
          }
        }
      }
    }
  }, [searchParams]);

  // Load GitHub App Info on mount
  useEffect(() => {
    fetch(`${apiUrl}/github/app-info`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setAppInfo(data);
      })
      .catch(() => {});
  }, [apiUrl]);

  // If redirected with installation_id from GitHub
  useEffect(() => {
    if (installationIdParam) {
      const instId = Number(installationIdParam);
      fetch(`${apiUrl}/github/repos?installation_id=${instId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.repositories && data.repositories.length > 0) {
            setUserRepos(data.repositories);
            setActiveTab("token");
          }
        })
        .catch(() => {});
    }
  }, [installationIdParam, apiUrl]);

  // 1. Verify Direct Repo via Real GitHub API
  const handleVerifyDirectRepo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!repoInput.trim()) {
      setErrorMsg("Please enter a GitHub repository name (e.g. facebook/react or your-username/your-repo)");
      return;
    }

    setIsVerifyingRepo(true);
    setErrorMsg("");
    setVerifiedRepo(null);

    try {
      const res = await fetch(`${apiUrl}/github/verify-repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: repoInput.trim(),
          token: personalToken.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Repository could not be verified (${res.status})`);
      }

      setVerifiedRepo(data.repository);
      handleSelectRepo(data.repository);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsVerifyingRepo(false);
    }
  };

  // 2. Verify GitHub Personal Access Token & Load Real User Repos
  const handleVerifyToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!personalToken.trim()) {
      setErrorMsg("Please enter your GitHub Personal Access Token");
      return;
    }

    setIsVerifyingToken(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${apiUrl}/github/verify-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: personalToken.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid GitHub token");
      }

      setGithubUser(data.user);
      setUserRepos(data.repositories || []);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsVerifyingToken(false);
    }
  };

  const handleSelectRepo = (repo: RepoItem) => {
    setSelectedRepo(repo);
    setProjectName(repo.name);
    setProductionBranch(repo.defaultBranch || "main");
    if (typeof window !== "undefined") {
      sessionStorage.setItem("new_project_selected_repo", JSON.stringify(repo));
    }

    // If static status hasn't been verified yet (e.g. from token repo list), detect it in background
    if (repo.isStatic === undefined && repo.fullName) {
      fetch(`${apiUrl}/github/verify-repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: repo.fullName,
          token: personalToken.trim() || undefined,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.repository) {
            setSelectedRepo((prev) => {
              if (!prev || prev.fullName !== repo.fullName) return prev;
              const updated = {
                ...prev,
                isStatic: data.repository.isStatic,
                detectedType: data.repository.detectedType,
              };
              if (typeof window !== "undefined") {
                sessionStorage.setItem("new_project_selected_repo", JSON.stringify(updated));
              }
              return updated;
            });
          }
        })
        .catch(() => {});
    }

    setStep(2);
  };

  const handleFinish = async () => {
    if (!selectedRepo) return;
    setErrorMsg("");
    const connId = selectedProvider === "azure"
      ? (azureConnectionId || searchParams.get("connectionId") || undefined)
      : selectedProvider === "digitalocean"
      ? (doConnectionId || searchParams.get("connectionId") || undefined)
      : selectedProvider === "gcp"
      ? (gcpConnectionId || searchParams.get("connectionId") || undefined)
      : (awsConnectionId || undefined);

    const envMap = getCleanEnvMap();

    createProject.mutate({
      name: projectName || selectedRepo.name,
      githubRepoOwner: selectedRepo.owner,
      githubRepoName: selectedRepo.name,
      githubInstallationId: 1001,
      productionBranch: productionBranch || "main",
      cloudProvider: selectedProvider,
      cloudConnectionId: connId,
      envVars: Object.keys(envMap).length > 0 ? envMap : undefined,
    });
  };

  const filteredRepos = userRepos.filter((r) =>
    r.fullName.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="max-w-4xl lg:max-w-5xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
          Connect New Project
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Link your GitHub monorepo and select your cloud deployment target (AWS or Azure).
        </p>
      </div>

      {/* Step Progress Tracker */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          {[
            { num: 1, label: "Repository" },
            { num: 2, label: "Cloud Target" },
            { num: 3, label: "Configure" },
            { num: 4, label: "Environment" },
          ].map((s) => (
            <div key={s.num} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                    step === s.num
                      ? "text-white"
                      : step > s.num
                      ? "text-emerald-400"
                      : "text-zinc-500"
                  }`}
                >
                  <span>{step > s.num ? "✓" : `${s.num}.`}</span>
                  <span>{s.label}</span>
                </span>
                {step === s.num && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                )}
              </div>
              <div
                className={`h-1 rounded-full transition-all duration-300 ${
                  step > s.num
                    ? "bg-emerald-400"
                    : step === s.num
                    ? "bg-white"
                    : "bg-zinc-800"
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-mono flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: Link & Verify GitHub Repository */}
      {step === 1 && (
        <Card className="bg-[#09090b] border-white/10 shadow-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-white/10 text-white flex items-center justify-center">
                <Github className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg text-white font-mono">Step 1: Link GitHub Repository</CardTitle>
                <CardDescription className="text-zinc-400">
                  Verify and connect your repository with live GitHub API checks.
                </CardDescription>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-2 pt-4 border-b border-white/[0.08] pb-1">
              <button
                type="button"
                onClick={() => { setActiveTab("direct"); setErrorMsg(""); }}
                className={`text-xs font-mono px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  activeTab === "direct"
                    ? "bg-white text-black font-semibold"
                    : "text-zinc-400 hover:text-white bg-transparent"
                }`}
              >
                Direct Repo Import
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("token"); setErrorMsg(""); }}
                className={`text-xs font-mono px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  activeTab === "token"
                    ? "bg-white text-black font-semibold"
                    : "text-zinc-400 hover:text-white bg-transparent"
                }`}
              >
                Personal Token / All Repos
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("app"); setErrorMsg(""); }}
                className={`text-xs font-mono px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  activeTab === "app"
                    ? "bg-white text-black font-semibold"
                    : "text-zinc-400 hover:text-white bg-transparent"
                }`}
              >
                GitHub App
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-2">
            {/* TAB 1: Direct Repo Import */}
            {activeTab === "direct" && (
              <div className="space-y-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleVerifyDirectRepo(e);
                  }}
                  className="space-y-3"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300 block font-mono">
                      GitHub Repository Name or URL:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. facebook/react or your-username/your-monorepo"
                        value={repoInput}
                        onChange={(e) => setRepoInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleVerifyDirectRepo();
                          }
                        }}
                        className="flex-1 h-10 px-3 rounded-lg bg-zinc-900 border border-white/15 text-xs text-white placeholder:text-zinc-600 font-mono focus:outline-none focus:border-white"
                      />
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleVerifyDirectRepo();
                        }}
                        disabled={isVerifyingRepo || !repoInput.trim()}
                        className="h-10 px-5 text-xs font-mono bg-white hover:bg-zinc-200 text-black font-semibold cursor-pointer shrink-0"
                      >
                        {isVerifyingRepo ? <Spinner size="sm" /> : "Verify Repo"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-500 font-mono flex items-center justify-between">
                      <span>Optional Personal Access Token (for private repositories):</span>
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo,read:org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-400 hover:text-white underline inline-flex items-center gap-1"
                      >
                        <span>Generate on GitHub</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </label>
                    <input
                      type="password"
                      placeholder="ghp_... or github_pat_... (Leave blank for public repositories)"
                      value={personalToken}
                      onChange={(e) => setPersonalToken(e.target.value)}
                      className="w-full h-8 px-3 rounded-md bg-zinc-900/60 border border-white/10 text-xs text-white placeholder:text-zinc-600 font-mono focus:outline-none focus:border-white/30"
                    />
                  </div>
                </form>

                {/* Verified Repo Result Card */}
                {verifiedRepo && (
                  <div className="p-4 rounded-xl bg-gradient-to-b from-emerald-950/20 via-zinc-900 to-zinc-900 border border-emerald-500/30 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {verifiedRepo.ownerAvatar ? (
                          <img
                            src={verifiedRepo.ownerAvatar}
                            alt={verifiedRepo.owner}
                            className="h-9 w-9 rounded-lg border border-white/10"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center">
                            <FolderGit2 className="h-5 w-5 text-emerald-400" />
                          </div>
                        )}
                        <div>
                          <h4 className="text-sm font-semibold text-white font-mono flex items-center gap-2">
                            <span>{verifiedRepo.fullName}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-normal">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Verified</span>
                            </span>
                          </h4>
                          {verifiedRepo.description && (
                            <p className="text-xs text-zinc-400 mt-0.5 max-w-md line-clamp-1">
                              {verifiedRepo.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleSelectRepo(verifiedRepo)}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs font-mono gap-1.5 cursor-pointer"
                      >
                        <span>Select Repo</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-zinc-400 pt-2 border-t border-white/5">
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3.5 w-3.5 text-zinc-300" />
                        <span>Branch: {verifiedRepo.defaultBranch}</span>
                      </span>
                      {verifiedRepo.stars !== undefined && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-400" />
                          <span>{verifiedRepo.stars.toLocaleString()}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        {verifiedRepo.isPrivate ? (
                          <>
                            <Lock className="h-3.5 w-3.5 text-zinc-300" />
                            <span>Private</span>
                          </>
                        ) : (
                          <>
                            <Globe className="h-3.5 w-3.5 text-zinc-300" />
                            <span>Public</span>
                          </>
                        )}
                      </span>
                      {verifiedRepo.language && (
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/5 text-[10px]">
                          {verifiedRepo.language}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Token / Account Repos List */}
            {activeTab === "token" && (
              <div className="space-y-4">
                {!githubUser ? (
                  <form onSubmit={handleVerifyToken} className="space-y-3">
                    <p className="text-xs text-zinc-400">
                      Enter a GitHub Personal Access Token to browse and select from all your personal and organization repositories.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="ghp_... or github_pat_..."
                        value={personalToken}
                        onChange={(e) => setPersonalToken(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleVerifyToken();
                          }
                        }}
                        className="flex-1 h-10 px-3 rounded-lg bg-zinc-900 border border-white/15 text-xs text-white placeholder:text-zinc-600 font-mono focus:outline-none focus:border-white"
                      />
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleVerifyToken();
                        }}
                        disabled={isVerifyingToken || !personalToken.trim()}
                        className="h-10 px-5 text-xs font-mono bg-white hover:bg-zinc-200 text-black font-semibold cursor-pointer shrink-0"
                      >
                        {isVerifyingToken ? <Spinner size="sm" /> : "Authenticate"}
                      </Button>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo,read:org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-400 hover:text-white underline inline-flex items-center gap-1"
                      >
                        <span>Generate a Personal Access Token on GitHub (requires 'repo' scope)</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </form>
                ) : (
                  <div className="space-y-4">
                    {/* User profile banner */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-white/10 font-mono text-xs">
                      <div className="flex items-center gap-2.5">
                        {githubUser.avatarUrl && (
                          <img
                            src={githubUser.avatarUrl}
                            alt={githubUser.login}
                            className="h-7 w-7 rounded-full border border-white/10"
                          />
                        )}
                        <div>
                          <span className="text-white font-semibold">{githubUser.name || githubUser.login}</span>
                          <span className="text-zinc-500 ml-1.5">(@{githubUser.login})</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setGithubUser(null); setUserRepos([]); }}
                        className="text-zinc-500 hover:text-zinc-300 text-[11px] underline cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>

                    {/* Search box */}
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-3 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Search your repositories..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 rounded-lg bg-zinc-900 border border-white/15 text-xs text-white placeholder:text-zinc-600 font-mono focus:outline-none focus:border-white"
                      />
                    </div>

                    {/* Repos list */}
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {filteredRepos.length === 0 ? (
                        <p className="text-xs text-zinc-500 text-center py-6 font-mono">
                          No repositories found matching "{searchFilter}".
                        </p>
                      ) : (
                        filteredRepos.map((repo) => (
                          <div
                            key={repo.id}
                            onClick={() => handleSelectRepo(repo)}
                            className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-black hover:bg-zinc-900 hover:border-white/20 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FolderGit2 className="h-4 w-4 text-zinc-400 group-hover:text-white shrink-0" />
                              <div className="truncate">
                                <h5 className="text-xs font-semibold text-white font-mono truncate">
                                  {repo.fullName}
                                </h5>
                                <p className="text-[10px] text-zinc-500 font-mono">
                                  Branch: {repo.defaultBranch}
                                </p>
                              </div>
                            </div>
                            <Button size="sm" variant="outline" className="text-xs font-mono h-7 px-2.5 cursor-pointer">
                              Select
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: GitHub App */}
            {activeTab === "app" && (
              <div className="p-5 rounded-lg bg-gradient-to-b from-zinc-900/80 via-black to-black border border-white/10 space-y-4 text-center">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white font-mono">
                    Custom GitHub App Integration
                  </h4>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    {appInfo.configured
                      ? `Your GitHub App (${appInfo.slug}) is ready for installation.`
                      : "For full webhook automation in production, register a GitHub App in your GitHub organization."}
                  </p>
                </div>

                {appInfo.configured ? (
                  <Button
                    onClick={() => window.open(appInfo.installUrl!, "_blank", "noopener,noreferrer")}
                    className="w-full sm:w-auto bg-white hover:bg-zinc-200 text-black font-semibold text-xs h-10 px-6 font-mono inline-flex items-center justify-center gap-2 transition-all cursor-pointer mx-auto"
                  >
                    <Github className="h-4 w-4" />
                    <span>Install GitHub App on Your Account</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <div className="p-3 bg-zinc-900 rounded-lg border border-white/10 text-left font-mono text-xs text-zinc-300 space-y-2">
                    <p className="text-white font-semibold">To set up a custom GitHub App:</p>
                    <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                      <li>Go to GitHub Settings → Developer Settings → GitHub Apps → New GitHub App</li>
                      <li>Set Webhook URL to: <code className="text-white">http://your-domain/webhooks/github</code></li>
                      <li>Add <code className="text-white">GITHUB_APP_SLUG</code> and <code className="text-white">GITHUB_APP_ID</code> in your <code className="text-white">.env</code></li>
                    </ol>
                    <p className="text-emerald-400 text-[11px] pt-1">
                      💡 Tip: You can immediately use the <strong>Direct Repo Import</strong> tab without registering an app!
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Select Cloud Deployment Target */}
      {step === 2 && selectedRepo && (
        <Card className="bg-[#09090b] border-white/10 shadow-2xl overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 font-semibold border border-white/10">
                    Step 2 of 4
                  </span>
                  <CardTitle className="text-lg text-white font-mono">Select Cloud Provider</CardTitle>
                </div>
                <CardDescription className="text-zinc-400 text-xs sm:text-sm flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span>Deploying</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-white font-mono text-xs font-semibold">
                    <Github className="h-3 w-3 text-white" />
                    {selectedRepo.fullName}
                  </span>
                  <span>Choose where to build and run your services.</span>
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep(1);
                  if (selectedRepo?.fullName) {
                    setRepoInput(selectedRepo.fullName);
                  }
                }}
                className="font-mono text-xs cursor-pointer text-zinc-400 hover:text-white shrink-0 self-start sm:self-center flex items-center gap-1.5"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Change Repo</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <CloudProviderCard
                provider="aws"
                title="Amazon Web Services"
                description="ECS Fargate • ECR • Secrets"
                badge="Supported"
                isConnected={connectedProviders.aws}
                isSelected={selectedProvider === "aws"}
                onSelect={(p) => setSelectedProvider(p)}
                onConnect={!connectedProviders.aws ? () => setWizardModal("aws") : undefined}
              />

              <CloudProviderCard
                provider="azure"
                title="Microsoft Azure"
                description="Container Apps • ACR • Key Vault"
                badge="1-Click SSO"
                isConnected={connectedProviders.azure}
                isSelected={selectedProvider === "azure"}
                onSelect={(p) => setSelectedProvider(p)}
                onConnect={!connectedProviders.azure ? handleConnectAzure : undefined}
              />

              <CloudProviderCard
                provider="digitalocean"
                title="DigitalOcean"
                description="App Platform • DOCR • Spaces"
                badge="Coming Soon"
                disabled={true}
              />

              <CloudProviderCard
                provider="gcp"
                title="Google Cloud"
                description="Cloud Run • Artifact Reg • Secrets"
                badge="Coming Soon"
                disabled={true}
              />
            </div>

            {/* Active Account Status Banner */}
            {connectedProviders[selectedProvider] ? (
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/20 via-zinc-900 to-zinc-900 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-zinc-400">Targeting connected account:</span>
                      <strong className="text-white font-semibold">
                        {selectedProvider === "aws" && "AWS Production Account (Role Delegation)"}
                        {selectedProvider === "azure" && "Azure Subscription (1-Click SSO)"}
                        {selectedProvider === "digitalocean" && "DigitalOcean App Platform (1-Click OAuth)"}
                        {selectedProvider === "gcp" && "Google Cloud Run (1-Click OAuth)"}
                      </strong>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>Zero static credentials stored • Ephemeral STS tokens • Least-privilege role</span>
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold self-start sm:self-center shrink-0">
                  Ready to Deploy
                </span>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/20 via-zinc-900 to-zinc-900 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-white font-semibold">
                        {selectedProvider === "aws" && "Amazon Web Services"}
                        {selectedProvider === "azure" && "Microsoft Azure"}
                        {selectedProvider === "digitalocean" && "DigitalOcean"}
                        {selectedProvider === "gcp" && "Google Cloud"}
                      </strong>
                      <span className="text-zinc-400">is not connected yet.</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Connect your account to allow Shipora to provision resources and deploy containers.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (selectedProvider === "aws") setWizardModal("aws");
                    else if (selectedProvider === "azure") handleConnectAzure();
                    else if (selectedProvider === "digitalocean") handleConnectDigitalOcean();
                    else if (selectedProvider === "gcp") handleConnectGcp();
                  }}
                  className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs h-8 px-3 font-mono cursor-pointer shrink-0 self-start sm:self-center flex items-center gap-1"
                >
                  <span>Connect Now</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t border-white/[0.08] pt-4">
            <Button
              variant="ghost"
              onClick={() => setStep(1)}
              className="font-mono text-xs cursor-pointer flex items-center gap-1.5 text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </Button>
            <Button
              onClick={() => setStep(3)}
              className="bg-white hover:bg-zinc-200 text-black font-semibold font-mono text-xs h-9 px-5 cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <span>Continue to Configuration</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 3: Configure & Confirm */}
      {step === 3 && selectedRepo && (
        <Card className="bg-[#09090b] border-white/10 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg text-white font-mono">Step 3: Configure Project</CardTitle>
            <CardDescription className="text-zinc-400">
              Set project details and production branch to monitor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 font-mono">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 font-mono">
                Production Branch
              </label>
              {selectedRepo.branches && selectedRepo.branches.length > 1 ? (
                <select
                  value={productionBranch}
                  onChange={(e) => setProductionBranch(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-white cursor-pointer"
                >
                  {selectedRepo.branches.map((b) => (
                    <option key={b} value={b}>
                      {b} {b === selectedRepo.defaultBranch ? "(default)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={productionBranch}
                  onChange={(e) => setProductionBranch(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-white"
                />
              )}
              <p className="text-[11px] text-zinc-500 font-mono">
                Pushes to this branch will trigger automatic Conflict Guard pre-deploy static AST checks.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/10 text-xs font-mono text-zinc-300 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Repository:</span>
                <span className="text-white font-semibold">{selectedRepo.fullName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Cloud Target:</span>
                <span className="text-emerald-400 font-semibold uppercase">{selectedProvider}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Branch:</span>
                <span className="text-zinc-200">{productionBranch}</span>
              </div>
              {selectedRepo.isStatic && (
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="text-zinc-500">Project Type:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Static Website ({selectedRepo.detectedType ? selectedRepo.detectedType.toUpperCase() : "STATIC"})</span>
                  </span>
                </div>
              )}
            </div>

            {selectedRepo.isStatic && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Static website detected:</strong> Zero server secrets required. You can deploy directly!
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold shrink-0">
                  Ready to Deploy
                </span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t border-white/[0.08] pt-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setStep(2)} className="font-mono text-xs cursor-pointer">
                Back
              </Button>

              {/* For static repos: option to add environment variables on the left side */}
              {selectedRepo.isStatic && (
                <Button
                  variant="outline"
                  onClick={() => setStep(4)}
                  className="font-mono text-xs h-9 px-3.5 border-white/15 hover:bg-zinc-900 text-zinc-300 hover:text-white cursor-pointer flex items-center gap-1.5"
                >
                  <KeyRound className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Add Environment Variables</span>
                </Button>
              )}
            </div>

            {selectedRepo.isStatic ? (
              /* For static repos: Direct Deploy button on the right side */
              <Button
                onClick={handleFinish}
                disabled={createProject.isPending || triggerDeploy.isPending}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold font-mono text-xs h-9 px-5 cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-950/30"
              >
                {createProject.isPending || triggerDeploy.isPending ? (
                  <>
                    <Spinner size="sm" />
                    <span>Deploying...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-black" />
                    <span>Deploy Now</span>
                  </>
                )}
              </Button>
            ) : (
              /* For dynamic repos: Standard Continue to Environment Variables */
              <Button
                onClick={() => setStep(4)}
                className="bg-white hover:bg-zinc-200 text-black font-semibold font-mono text-xs h-9 px-4 cursor-pointer flex items-center gap-1.5"
              >
                <span>Continue to Environment Variables</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </CardFooter>
        </Card>
      )}

      {/* STEP 4: Environment Variables (Vercel Style) */}
      {step === 4 && selectedRepo && (
        <Card className="bg-[#09090b] border-white/10 shadow-2xl">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-white/10 text-white flex items-center justify-center shrink-0">
                  <KeyRound className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-lg text-white font-mono flex items-center gap-2">
                    <span>Step 4: Environment Variables</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Vercel Style
                    </span>
                  </CardTitle>
                  <CardDescription className="text-zinc-400 text-xs mt-0.5">
                    Add runtime configuration, database URLs, and secret keys injected into your deployed containers.
                  </CardDescription>
                </div>
              </div>

              {/* Mode toggle */}
              <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg border border-white/10 shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setEnvMode("paste")}
                  className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    envMode === "paste"
                      ? "bg-white text-black font-semibold shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Paste .env</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEnvMode("form")}
                  className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    envMode === "form"
                      ? "bg-white text-black font-semibold shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  <span>Key-Value Form</span>
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* TAB 1: PASTE RAW .ENV */}
            {envMode === "paste" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-300 font-semibold">Paste raw .env content:</span>
                    <span className="text-zinc-500 text-[11px]">Supports comments (#) and quotes</span>
                  </div>
                  <textarea
                    rows={8}
                    value={envRawText}
                    onChange={(e) => setEnvRawText(e.target.value)}
                    placeholder={`DATABASE_URL=postgresql://neondb_owner:password@ep-host.neon.tech/neondb?sslmode=require\nCLERK_SECRET_KEY=sk_test_...\nUPSTASH_REDIS_REST_URL=https://...\nAPI_KEY=your_secret_key`}
                    className="w-full p-3 rounded-lg bg-zinc-900 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-white leading-relaxed placeholder:text-zinc-600 resize-y"
                  />
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-[11px] font-mono text-zinc-400">
                    {parseEnvText(envRawText).length > 0 ? (
                      <span className="text-emerald-400 font-semibold">
                        ✅ {parseEnvText(envRawText).length} variable(s) ready to inject
                      </span>
                    ) : (
                      <span className="text-zinc-500">
                        Paste your database connection string and secret keys here
                      </span>
                    )}
                  </div>
                  {envRawText.trim() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleApplyRawEnv}
                      className="h-8 text-xs font-mono cursor-pointer border-white/20 hover:bg-zinc-800 text-zinc-200"
                    >
                      <span>Review in Key-Value Form ({parseEnvText(envRawText).length})</span>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: KEY-VALUE FORM */}
            {envMode === "form" && (
              <div className="space-y-3">
                {/* Common variable chips */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono text-zinc-400 pb-1">
                  <span className="text-zinc-500">Quick add:</span>
                  {["DATABASE_URL", "CLERK_SECRET_KEY", "UPSTASH_REDIS_REST_URL", "JWT_SECRET", "NEXTAUTH_SECRET", "NODE_ENV"].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        const exists = envVarsList.some((e) => e.key === chip);
                        if (!exists) {
                          setEnvVarsList((prev) => [
                            ...prev.filter((p) => p.key.trim() !== "" || p.value.trim() !== ""),
                            { id: `${Date.now()}-${chip}`, key: chip, value: "", show: false },
                          ]);
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white cursor-pointer transition-colors"
                    >
                      +{chip}
                    </button>
                  ))}
                </div>

                {/* Rows list */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {envVarsList.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="KEY (e.g. DATABASE_URL)"
                        value={item.key}
                        onChange={(e) =>
                          handleUpdateEnvRow(item.id, "key", e.target.value.toUpperCase().replace(/\s+/g, "_"))
                        }
                        className="w-2/5 h-9 px-3 rounded-lg bg-zinc-900 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-white uppercase placeholder:normal-case placeholder:text-zinc-600"
                      />
                      <div className="flex-1 relative flex items-center">
                        <input
                          type={item.show ? "text" : "password"}
                          placeholder="VALUE (e.g. postgresql://...)"
                          value={item.value}
                          onChange={(e) => handleUpdateEnvRow(item.id, "value", e.target.value)}
                          className="w-full h-9 pl-3 pr-8 rounded-lg bg-zinc-900 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-white placeholder:text-zinc-600"
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleShow(item.id)}
                          className="absolute right-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                        >
                          {item.show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEnvRow(item.id)}
                        disabled={envVarsList.length === 1 && !item.key && !item.value}
                        className="h-9 w-9 flex items-center justify-center rounded-lg bg-zinc-900 border border-white/10 text-zinc-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors cursor-pointer shrink-0 disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddEnvRow}
                    className="h-8 text-xs font-mono cursor-pointer border-white/15 hover:bg-zinc-800 text-zinc-200 flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Variable</span>
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      const text = envVarsList
                        .filter((e) => e.key.trim())
                        .map((e) => `${e.key}=${e.value}`)
                        .join("\n");
                      setEnvRawText(text);
                      setEnvMode("paste");
                    }}
                    className="text-xs font-mono text-zinc-400 hover:text-white underline cursor-pointer"
                  >
                    Switch to Raw Paste
                  </button>
                </div>
              </div>
            )}

            {/* Deployment Target Info Banner */}
            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-white/10 text-xs font-mono space-y-2">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Deploy Target:</span>
                <span className="text-white font-semibold flex items-center gap-1.5">
                  <span className="uppercase text-emerald-400">{selectedProvider}</span>
                  <span>({selectedRepo.fullName})</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Environment Variables Configured:</span>
                <span className="text-white font-semibold">
                  {Object.keys(getCleanEnvMap()).length} variable(s)
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 pt-1 border-t border-white/[0.06] flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>
                  Variables are AES-256 encrypted and injected into {selectedProvider === "azure" ? "Azure Container Apps & Key Vault" : "AWS Secrets Manager"}.
                </span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-white/[0.08] pt-4">
            <Button variant="ghost" onClick={() => setStep(3)} className="font-mono text-xs cursor-pointer">
              Back
            </Button>
            <Button
              onClick={handleFinish}
              disabled={createProject.isPending || triggerDeploy.isPending}
              className="bg-white hover:bg-zinc-200 text-black font-semibold font-mono text-xs h-9 px-5 cursor-pointer flex items-center gap-2"
            >
              {createProject.isPending || triggerDeploy.isPending ? (
                <>
                  <Spinner size="sm" />
                  <span>Deploying & Provisioning...</span>
                </>
              ) : Object.keys(getCleanEnvMap()).length > 0 ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-black" />
                  <span>Deploy ({Object.keys(getCleanEnvMap()).length} Env Vars)</span>
                </>
              ) : (
                "Complete & Deploy"
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Cloud Connect Wizards Modals */}
      {wizardModal === "aws" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <AwsConnectWizard
            onConnected={(newConn) => {
              setConnectedProviders((prev) => ({ ...prev, aws: true }));
              setSelectedProvider("aws");
              if (newConn?.id) {
                setAwsConnectionId(newConn.id);
              }
              setWizardModal(null);
            }}
            onCancel={() => setWizardModal(null)}
          />
        </div>
      )}

      {wizardModal === "azure" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <AzureConnectWizard
            returnTo="/dashboard/new-project"
            onConnected={(newConn) => {
              setConnectedProviders((prev) => ({ ...prev, azure: true }));
              setSelectedProvider("azure");
              setWizardModal(null);
            }}
            onCancel={() => setWizardModal(null)}
          />
        </div>
      )}

      {wizardModal === "digitalocean" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <DigitalOceanConnectWizard
            returnTo="/dashboard/new-project"
            onConnected={(newConn) => {
              setConnectedProviders((prev) => ({ ...prev, digitalocean: true }));
              setSelectedProvider("digitalocean");
              if (newConn?.id) {
                setDoConnectionId(newConn.id);
              }
              setWizardModal(null);
            }}
            onCancel={() => setWizardModal(null)}
          />
        </div>
      )}

      {wizardModal === "gcp" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <GcpConnectWizard
            returnTo="/dashboard/new-project"
            onConnected={(newConn) => {
              setConnectedProviders((prev) => ({ ...prev, gcp: true }));
              setSelectedProvider("gcp");
              if (newConn?.id) {
                setGcpConnectionId(newConn.id);
              }
              setWizardModal(null);
            }}
            onCancel={() => setWizardModal(null)}
          />
        </div>
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

