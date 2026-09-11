"use client";

import React, { useState } from "react";
import { Lock, AlertCircle, Check, ArrowRight, ExternalLink, ChevronDown, ChevronUp, FileCode } from "lucide-react";
import { Button, Spinner } from "@shipora/ui";

export interface GcpConnectWizardProps {
  onConnected?: (connection: any) => void;
  onCancel?: () => void;
  returnTo?: string;
}

// Official Google 4-color vector logo
function GoogleLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GcpConnectWizard({
  onConnected,
  onCancel,
  returnTo,
}: GcpConnectWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [connectingState, setConnectingState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual fallback state
  const [showManual, setShowManual] = useState(false);
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [projectId, setProjectId] = useState("");
  const [region, setRegion] = useState("us-central1");
  const [displayName, setDisplayName] = useState("");

  const [savedConnection, setSavedConnection] = useState<any>(null);

  const handleOneClickGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setConnectingState("Connecting to Google Cloud OAuth...");

    try {
      const targetReturn =
        returnTo ||
        (typeof window !== "undefined"
          ? window.location.pathname
          : "/dashboard/settings/cloud-connections");
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const endpoint = `${base}/auth/gcp/start?returnTo=${encodeURIComponent(targetReturn)}`;
      const res = await fetch(endpoint);

      if (!res.ok) {
        throw new Error(`Failed to start Google Cloud OAuth flow (${res.status})`);
      }

      const data = await res.json();

      if (!data.authUrl) {
        throw new Error("No authorization URL returned from server");
      }

      setConnectingState("Redirecting to Google login...");

      // Redirect the browser to Google OAuth consent page
      window.location.href = data.authUrl;
    } catch (err: unknown) {
      setError((err as Error).message);
      setLoading(false);
      setConnectingState(null);
    }
  };

  const handleManualConnect = async () => {
    if (!serviceAccountJson.trim()) {
      setError("Please paste your Google Cloud Service Account Key JSON");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${base}/auth/gcp/connect-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: serviceAccountJson.trim(),
          projectId: projectId.trim() || undefined,
          displayName: displayName.trim() || undefined,
          region: region.trim() || "us-central1",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to verify Google Cloud credentials");
      }

      const connection = data.connection || {
        id: "conn-gcp-" + Math.random().toString(36).slice(2, 8),
        provider: "gcp" as const,
        displayName: displayName.trim() || "Google Cloud Project",
        projectId: projectId.trim() || "gcp-production",
        region: region.trim() || "us-central1",
        status: "connected" as const,
        connectedAt: new Date(),
      };

      setSavedConnection(connection);
      setStep(2);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    if (savedConnection) {
      onConnected?.(savedConnection);
    }
    onCancel?.();
  };

  return (
    <div className="p-6 rounded-xl border border-white/10 bg-[#09090b] space-y-5 max-w-lg w-full mx-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center font-bold text-xs font-mono text-white">
            <GoogleLogo className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white font-mono flex items-center gap-2">
              <span>Connect Google Cloud</span>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 font-mono font-normal">
                1-Click OAuth
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Zero-touch Google authorization & automated Cloud Run service discovery
            </p>
          </div>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          {/* Main 1-Click Action Card */}
          <div className="p-5 rounded-lg bg-gradient-to-b from-blue-900/15 via-black to-black border border-blue-500/25 space-y-4 text-center">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-[11px] font-mono text-blue-300">
                <Lock className="h-3 w-3" />
                <span>Google Cloud Platform Scoped Permissions</span>
              </div>
              <h4 className="text-sm font-medium text-white">
                Instant Google Cloud Single Sign-On
              </h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Authorize Shipora in 1 click. We’ll auto-discover your GCP projects, configure Cloud Run services, and wire Artifact Registry.
              </p>
            </div>

            {connectingState ? (
              <div className="py-3 space-y-2 bg-zinc-900/60 rounded-md border border-white/5 font-mono text-xs text-blue-300 flex flex-col items-center justify-center">
                <Spinner size="sm" />
                <span className="animate-pulse">{connectingState}</span>
              </div>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={handleOneClickGoogleSignIn}
                disabled={loading}
                className="w-full bg-white hover:bg-zinc-100 text-black font-semibold text-xs h-10 flex items-center justify-center gap-2.5 transition-all shadow-md hover:shadow-white/10 cursor-pointer"
              >
                <GoogleLogo className="h-4 w-4" />
                <span>Sign in with Google Cloud</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}

            <div className="grid grid-cols-3 gap-2 pt-1 text-left">
              <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                <span className="text-[10px] text-zinc-400 block font-mono">Compute</span>
                <span className="text-[11px] font-medium text-white">Cloud Run</span>
              </div>
              <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                <span className="text-[10px] text-zinc-400 block font-mono">Registry</span>
                <span className="text-[11px] font-medium text-white">Artifact Reg</span>
              </div>
              <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                <span className="text-[10px] text-zinc-400 block font-mono">Secrets</span>
                <span className="text-[11px] font-medium text-white">Secret Manager</span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-zinc-900/60 border border-white/5 text-left font-mono text-[11px] text-zinc-400 space-y-1">
              <span className="text-zinc-300 font-medium block">Google Cloud OAuth Setup:</span>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                To sign in with your live Google account, add <code className="text-zinc-200">GCP_CLIENT_ID</code> and <code className="text-zinc-200">GCP_CLIENT_SECRET</code> to <code className="text-zinc-200">.env</code> (Redirect URI: <code className="text-zinc-200">http://localhost:4000/auth/gcp/callback</code>). Or connect instantly via Service Account JSON below.
              </p>
            </div>
          </div>

          {/* Collapsible Manual Service Account Option */}
          <div className="border-t border-white/[0.08] pt-3">
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="text-xs text-zinc-400 hover:text-white flex items-center justify-between w-full font-mono py-1 transition-colors cursor-pointer"
            >
              <span>Alternative: Connect via Service Account Key JSON</span>
              {showManual ? (
                <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              )}
            </button>

            {showManual && (
              <div className="mt-3 space-y-3 p-3.5 rounded-lg bg-black border border-white/10 text-left">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-zinc-300 block font-mono flex items-center gap-1">
                    <FileCode className="h-3 w-3 text-zinc-400" />
                    <span>Service Account JSON Key:</span>
                  </label>
                  <a
                    href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-blue-400 hover:underline flex items-center gap-1 font-mono"
                  >
                    <span>GCP Console</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <textarea
                  rows={4}
                  placeholder={`{\n  "type": "service_account",\n  "project_id": "my-gcp-project",\n  "private_key": "..."\n}`}
                  value={serviceAccountJson}
                  onChange={(e) => setServiceAccountJson(e.target.value)}
                  className="w-full p-2 rounded bg-zinc-900 border border-white/15 text-xs text-white placeholder:text-zinc-600 font-mono focus:outline-none focus:border-white resize-y"
                />

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-zinc-300 block font-mono">
                      Project ID (Optional):
                    </label>
                    <input
                      type="text"
                      placeholder="Auto-detected from JSON"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full h-8 px-2.5 rounded bg-zinc-900 border border-white/15 text-xs text-white placeholder:text-zinc-600 font-mono focus:outline-none focus:border-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-zinc-300 block font-mono">
                      Region:
                    </label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full h-8 px-2 rounded bg-zinc-900 border border-white/15 text-xs text-white font-mono focus:outline-none focus:border-white"
                    >
                      <option value="us-central1">us-central1 (Iowa)</option>
                      <option value="us-east1">us-east1 (S. Carolina)</option>
                      <option value="us-west1">us-west1 (Oregon)</option>
                      <option value="europe-west1">europe-west1 (Belgium)</option>
                      <option value="asia-south1">asia-south1 (Mumbai)</option>
                      <option value="asia-east1">asia-east1 (Taiwan)</option>
                    </select>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleManualConnect}
                  disabled={loading}
                  className="w-full text-xs font-mono h-8 mt-2 cursor-pointer"
                >
                  Verify & Connect Service Account
                </Button>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-300 text-xs font-mono">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="font-mono text-xs cursor-pointer"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="text-center py-5 space-y-4">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Check className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-white font-mono">
              Google Cloud Connected Successfully
            </h4>
            <p className="text-xs text-zinc-400">
              Your Google Cloud project is configured and ready for Cloud Run deployments.
            </p>
          </div>

          {savedConnection && (
            <div className="p-3.5 rounded-lg bg-zinc-900/80 border border-white/10 text-left font-mono text-xs space-y-1.5 text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-500">Account:</span>
                <span className="text-white truncate max-w-[200px]">{savedConnection.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Project ID:</span>
                <span className="text-zinc-300 truncate max-w-[200px]">
                  {savedConnection.projectId || savedConnection.clientId || "gcp-production"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Region:</span>
                <span className="text-zinc-300">{savedConnection.region || "us-central1"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Provider:</span>
                <span className="text-blue-400">Google Cloud Run & Artifact Registry</span>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={handleFinish}
              className="w-full font-mono text-xs cursor-pointer bg-white text-black hover:bg-zinc-200"
            >
              Done & Return
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
