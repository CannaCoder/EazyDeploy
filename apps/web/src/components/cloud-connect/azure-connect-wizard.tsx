"use client";

import React, { useState } from "react";
import { CheckCircle2, Shield, AlertCircle, Check, ArrowRight, ExternalLink, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { Button, Spinner } from "@shipora/ui";

export interface AzureConnectWizardProps {
  onConnected?: (connection: any) => void;
  onCancel?: () => void;
  returnTo?: string;
}

// Official Microsoft 4-square logo SVG
function MicrosoftLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export function AzureConnectWizard({ onConnected, onCancel, returnTo }: AzureConnectWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [connectingState, setConnectingState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual fallback state
  const [showManual, setShowManual] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState("");
  const [resourceGroup, setResourceGroup] = useState("shipora-deployments-rg");
  const [tenantId, setTenantId] = useState("");

  const [savedConnection, setSavedConnection] = useState<any>(null);

  const handleOneClickMicrosoftSignIn = async () => {
    setLoading(true);
    setError(null);
    setConnectingState("Connecting to Microsoft Entra ID...");

    try {
      const targetReturn = returnTo || (typeof window !== "undefined" ? window.location.pathname : "/dashboard/settings/cloud-connections");
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const endpoint = `${base}/auth/azure/start?returnTo=${encodeURIComponent(targetReturn)}`;
      const res = await fetch(endpoint);

      if (!res.ok) {
        throw new Error(`Failed to start Azure OAuth flow (${res.status})`);
      }

      const data = await res.json();

      if (!data.authUrl) {
        throw new Error("No authorization URL returned from server");
      }

      setConnectingState("Redirecting to Microsoft login...");

      // Redirect the browser to Microsoft's real login page
      window.location.href = data.authUrl;
    } catch (err: unknown) {
      setError((err as Error).message);
      setLoading(false);
      setConnectingState(null);
    }
  };

  const handleManualConnect = async () => {
    if (!subscriptionId.trim()) {
      setError("Please enter your Azure Subscription ID");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${base}/auth/azure/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: subscriptionId.trim(),
          resourceGroup: resourceGroup.trim() || "shipora-deployments-rg",
          tenantId: tenantId.trim() || "23543db5-54c7-4b3a-b22c-5f84b5594471",
          displayName: "Azure Subscription (Custom)",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to verify Azure subscription");
      }

      const connection = data.connection || {
        id: "conn-azure-" + Math.random().toString(36).slice(2, 8),
        provider: "azure" as const,
        displayName: "Azure Subscription (Custom)",
        subscriptionId,
        resourceGroup: resourceGroup.trim() || "shipora-deployments-rg",
        tenantId: tenantId.trim() || "23543db5-54c7-4b3a-b22c-5f84b5594471",
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
            <MicrosoftLogo className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white font-mono flex items-center gap-2">
              <span>Connect Microsoft Azure</span>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-normal">
                1-Click SSO
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Zero-touch Entra ID authentication & automated resource discovery
            </p>
          </div>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          {/* Main 1-Click Action Card */}
          <div className="p-5 rounded-lg bg-gradient-to-b from-blue-950/20 via-black to-black border border-blue-500/20 space-y-4 text-center">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] font-mono text-blue-300">
                <Lock className="h-3 w-3" />
                <span>Least-Privilege Scoped Access</span>
              </div>
              <h4 className="text-sm font-medium text-white">
                Instant Microsoft Single Sign-On
              </h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Authorize Shipora in 1 click. We’ll auto-detect your Azure Subscriptions and pre-configure Container Apps & ACR.
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
                onClick={handleOneClickMicrosoftSignIn}
                disabled={loading}
                className="w-full bg-white hover:bg-zinc-100 text-black font-semibold text-xs h-10 flex items-center justify-center gap-2.5 transition-all shadow-md hover:shadow-white/10 cursor-pointer"
              >
                <MicrosoftLogo className="h-4 w-4" />
                <span>Sign in with Microsoft Azure</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}

            <div className="grid grid-cols-3 gap-2 pt-1 text-left">
              <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                <span className="text-[10px] text-zinc-400 block font-mono">Compute</span>
                <span className="text-[11px] font-medium text-white">Container Apps</span>
              </div>
              <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                <span className="text-[10px] text-zinc-400 block font-mono">Registry</span>
                <span className="text-[11px] font-medium text-white">Azure ACR</span>
              </div>
              <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                <span className="text-[10px] text-zinc-400 block font-mono">Secrets</span>
                <span className="text-[11px] font-medium text-white">Key Vault</span>
              </div>
            </div>
          </div>

          {/* Collapsible Manual / CLI Option */}
          <div className="border-t border-white/[0.08] pt-3">
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="text-xs text-zinc-400 hover:text-white flex items-center justify-between w-full font-mono py-1 transition-colors cursor-pointer"
            >
              <span>Advanced: Enter Subscription ID or Service Principal manually</span>
              {showManual ? (
                <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              )}
            </button>

            {showManual && (
              <div className="mt-3 space-y-3 p-3.5 rounded-lg bg-black border border-white/10 text-left">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300 block font-mono">
                    Azure Subscription ID:
                  </label>
                  <input
                    type="text"
                    placeholder="00000000-0000-0000-0000-000000000000"
                    value={subscriptionId}
                    onChange={(e) => setSubscriptionId(e.target.value)}
                    className="w-full h-8 px-2.5 rounded bg-zinc-900 border border-white/15 text-xs text-white placeholder:text-zinc-600 font-mono focus:outline-none focus:border-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300 block font-mono">
                    Resource Group Name:
                  </label>
                  <input
                    type="text"
                    value={resourceGroup}
                    onChange={(e) => setResourceGroup(e.target.value)}
                    className="w-full h-8 px-2.5 rounded bg-zinc-900 border border-white/15 text-xs text-white font-mono focus:outline-none focus:border-white"
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
                  Verify & Connect Manually
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
              <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="font-mono text-xs cursor-pointer">
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
            <h4 className="text-sm font-semibold text-white font-mono">Azure Connected Successfully</h4>
            <p className="text-xs text-zinc-400">
              Your Microsoft Azure subscription is ready for serverless container deployments.
            </p>
          </div>

          {savedConnection && (
            <div className="p-3.5 rounded-lg bg-zinc-900/80 border border-white/10 text-left font-mono text-xs space-y-1.5 text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-500">Subscription:</span>
                <span className="text-white truncate max-w-[200px]">{savedConnection.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">ID:</span>
                <span className="text-zinc-300 truncate max-w-[200px]">{savedConnection.subscriptionId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Resource Group:</span>
                <span className="text-zinc-300">{savedConnection.resourceGroup}</span>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={handleFinish}
              className="w-full font-mono text-xs cursor-pointer"
            >
              Done & Return
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


