"use client";

import React, { useState } from "react";
import { Lock, AlertCircle, Check, ArrowRight, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Button, Spinner } from "@shipora/ui";

export interface DigitalOceanConnectWizardProps {
  onConnected?: (connection: any) => void;
  onCancel?: () => void;
  returnTo?: string;
}

// DigitalOcean Droplet vector logo
function DigitalOceanLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12.04 0C5.41 0 .04 5.37.04 12c0 4.19 2.15 7.88 5.43 10.02l3.41-3.41C6.75 17.26 5.4 14.8 5.4 12c0-3.66 2.98-6.64 6.64-6.64 3.66 0 6.64 2.98 6.64 6.64 0 2.21-.99 4.19-2.55 5.51l-.01.01 3.42 3.42C21.84 18.8 24.04 15.65 24.04 12c0-6.63-5.37-12-12-12zm-3.44 14.54v3.66h3.66v-3.66H8.6zm3.66 3.66h3.42v3.42h-3.42V18.2z"
        fill="#0080FF"
      />
    </svg>
  );
}

export function DigitalOceanConnectWizard({
  onConnected,
  onCancel,
  returnTo,
}: DigitalOceanConnectWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [connectingState, setConnectingState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual fallback state
  const [showManual, setShowManual] = useState(false);
  const [personalAccessToken, setPersonalAccessToken] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [savedConnection, setSavedConnection] = useState<any>(null);

  const handleOneClickOAuth = async () => {
    setLoading(true);
    setError(null);
    setConnectingState("Connecting to DigitalOcean OAuth...");

    try {
      const targetReturn =
        returnTo ||
        (typeof window !== "undefined"
          ? window.location.pathname
          : "/dashboard/settings/cloud-connections");
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const endpoint = `${base}/auth/digitalocean/start?returnTo=${encodeURIComponent(targetReturn)}`;
      const res = await fetch(endpoint);

      if (!res.ok) {
        throw new Error(`Failed to start DigitalOcean OAuth flow (${res.status})`);
      }

      const data = await res.json();

      if (!data.authUrl) {
        throw new Error("No authorization URL returned from server");
      }

      setConnectingState("Redirecting to DigitalOcean login...");

      // Redirect browser to DigitalOcean OAuth authorize page
      window.location.href = data.authUrl;
    } catch (err: unknown) {
      setError((err as Error).message);
      setLoading(false);
      setConnectingState(null);
    }
  };

  const handleManualConnect = async () => {
    if (!personalAccessToken.trim()) {
      setError("Please enter your DigitalOcean Personal Access Token");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${base}/auth/digitalocean/connect-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: personalAccessToken.trim(),
          displayName: displayName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to verify DigitalOcean Personal Access Token");
      }

      const connection = data.connection || {
        id: "conn-do-" + Math.random().toString(36).slice(2, 8),
        provider: "digitalocean" as const,
        displayName: displayName.trim() || "DigitalOcean Account",
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
            <DigitalOceanLogo className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white font-mono flex items-center gap-2">
              <span>Connect DigitalOcean</span>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-[#0080FF]/15 text-[#3399FF] border border-[#0080FF]/30 font-mono font-normal">
                1-Click OAuth
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Zero-touch DigitalOcean authorization & automated App Platform provisioning
            </p>
          </div>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          {/* Main 1-Click Action Card */}
          <div className="p-5 rounded-lg bg-gradient-to-b from-[#0080FF]/10 via-black to-black border border-[#0080FF]/25 space-y-4 text-center">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0080FF]/10 border border-[#0080FF]/25 text-[11px] font-mono text-[#3399FF]">
                <Lock className="h-3 w-3" />
                <span>Standard Scoped Permissions (read/write)</span>
              </div>
              <h4 className="text-sm font-medium text-white">
                Instant DigitalOcean Single Sign-On
              </h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Authorize Shipora in 1 click. We’ll automatically discover your account, configure App Platform, and wire DOCR container registries.
              </p>
            </div>

            {connectingState ? (
              <div className="py-3 space-y-2 bg-zinc-900/60 rounded-md border border-white/5 font-mono text-xs text-[#3399FF] flex flex-col items-center justify-center">
                <Spinner size="sm" />
                <span className="animate-pulse">{connectingState}</span>
              </div>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={handleOneClickOAuth}
                disabled={loading}
                className="w-full bg-[#0080FF] hover:bg-[#0070DF] text-white font-semibold text-xs h-10 flex items-center justify-center gap-2.5 transition-all shadow-md hover:shadow-[#0080FF]/20 cursor-pointer border-0"
              >
                <DigitalOceanLogo className="h-4 w-4" />
                <span>Sign in with DigitalOcean</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}

            <div className="grid grid-cols-3 gap-2 pt-1 text-left">
              <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                <span className="text-[10px] text-zinc-400 block font-mono">Compute</span>
                <span className="text-[11px] font-medium text-white">App Platform</span>
              </div>
              <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                <span className="text-[10px] text-zinc-400 block font-mono">Registry</span>
                <span className="text-[11px] font-medium text-white">DOCR</span>
              </div>
              <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                <span className="text-[10px] text-zinc-400 block font-mono">Static Sites</span>
                <span className="text-[11px] font-medium text-white">DO Spaces / CDN</span>
              </div>
            </div>
          </div>

          {/* Collapsible Manual PAT Option */}
          <div className="border-t border-white/[0.08] pt-3">
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="text-xs text-zinc-400 hover:text-white flex items-center justify-between w-full font-mono py-1 transition-colors cursor-pointer"
            >
              <span>Alternative: Enter Personal Access Token (PAT)</span>
              {showManual ? (
                <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              )}
            </button>

            {showManual && (
              <div className="mt-3 space-y-3 p-3.5 rounded-lg bg-black border border-white/10 text-left">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-zinc-300 block font-mono">
                    Personal Access Token (dop_v1_...):
                  </label>
                  <a
                    href="https://cloud.digitalocean.com/account/api/tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-[#3399FF] hover:underline flex items-center gap-1 font-mono"
                  >
                    <span>Generate in DO Console</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="dop_v1_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={personalAccessToken}
                  onChange={(e) => setPersonalAccessToken(e.target.value)}
                  className="w-full h-8 px-2.5 rounded bg-zinc-900 border border-white/15 text-xs text-white placeholder:text-zinc-600 font-mono focus:outline-none focus:border-white"
                />

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300 block font-mono">
                    Account Nickname (Optional):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Production Team Account"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full h-8 px-2.5 rounded bg-zinc-900 border border-white/15 text-xs text-white placeholder:text-zinc-600 font-mono focus:outline-none focus:border-white"
                  />
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleManualConnect}
                  disabled={loading}
                  className="w-full text-xs font-mono h-8 mt-2 cursor-pointer"
                >
                  Verify & Connect Token
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
              DigitalOcean Connected Successfully
            </h4>
            <p className="text-xs text-zinc-400">
              Your DigitalOcean account is configured and ready for App Platform deployments.
            </p>
          </div>

          {savedConnection && (
            <div className="p-3.5 rounded-lg bg-zinc-900/80 border border-white/10 text-left font-mono text-xs space-y-1.5 text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-500">Account:</span>
                <span className="text-white truncate max-w-[200px]">{savedConnection.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Connection ID:</span>
                <span className="text-zinc-300 truncate max-w-[200px]">{savedConnection.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Provider:</span>
                <span className="text-[#3399FF]">DigitalOcean App Platform</span>
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
