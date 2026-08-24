"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Cloud, Plus, Trash2, CheckCircle2, ShieldCheck, ExternalLink, RefreshCw, Copy, Check, Sparkles, AlertCircle } from "lucide-react";
import { Button, Badge, Spinner } from "@shipora/ui";
import { CloudProviderCard } from "@/components/cloud-connect/cloud-provider-card";
import { AwsConnectWizard } from "@/components/cloud-connect/aws-connect-wizard";
import { AzureConnectWizard } from "@/components/cloud-connect/azure-connect-wizard";
import type { CloudProvider } from "@shipora/types";

interface ConnectionItem {
  id: string;
  provider: CloudProvider;
  displayName: string;
  roleArn?: string;
  subscriptionId?: string;
  resourceGroup?: string;
  status: "connected" | "disconnected" | "expired" | "error";
  connectedAt?: Date | string;
}

function CloudConnectionsContent() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<ConnectionItem[]>([
    {
      id: "conn-aws-primary",
      provider: "aws",
      displayName: "AWS Production Account",
      roleArn: "arn:aws:iam::123456789012:role/ShiporaDeployRole-prod",
      status: "connected",
      connectedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  ]);

  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [wizardModal, setWizardModal] = useState<CloudProvider | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  // Fetch connections from API on mount
  useEffect(() => {
    fetch(`${apiUrl}/cloud-connect/connections`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.connections && Array.isArray(data.connections)) {
          setConnections(data.connections);
        }
      })
      .catch(() => {});
  }, [apiUrl]);

  useEffect(() => {
    const status = searchParams.get("status");
    const provider = searchParams.get("provider");
    const errorMsg = searchParams.get("message");

    if (status === "connected" && provider === "azure") {
      fetch(`${apiUrl}/cloud-connect/connections`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.connections && Array.isArray(data.connections)) {
            setConnections(data.connections);
          }
        })
        .catch(() => {});

      setNotification({
        type: "success",
        message: "Successfully connected Microsoft Azure via 1-Click SSO!",
      });
    } else if (status === "error") {
      setNotification({
        type: "error",
        message: errorMsg || "Failed to complete cloud connection.",
      });
    }
  }, [searchParams, apiUrl]);

  const handleConnectSuccess = (newConn: any) => {
    setConnections((prev) => [newConn, ...prev.filter((c) => c.id !== newConn.id)]);
    setWizardModal(null);
    setNotification({
      type: "success",
      message: `Successfully connected ${newConn.displayName || "account"}!`,
    });
  };

  const handleDisconnect = async (id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch(`${apiUrl}/cloud-connect/connections/${id}`, {
        method: "DELETE",
      });
    } catch {
      // ignore
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
          <Cloud className="h-3.5 w-3.5 text-zinc-400" />
          <span>Cloud Infrastructure</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-mono">
          Cloud Provider Connections
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
          Connect AWS and Microsoft Azure accounts with 1-Click SSO or least-privilege IAM roles for automated monorepo deployments.
        </p>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono animate-in fade-in slide-in-from-top-2 ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Provider Selector Grid */}
      <div className="space-y-3">
        <h2 className="text-[11px] font-mono font-medium text-zinc-500 uppercase tracking-wider">
          Available Cloud Providers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <CloudProviderCard
            provider="aws"
            title="Amazon Web Services"
            description="ECS Fargate & CodeBuild"
            badge="Supported"
            isConnected={connections.some((c) => c.provider === "aws")}
            onConnect={() => setWizardModal("aws")}
            onSelect={() => setWizardModal("aws")}
          />

          <CloudProviderCard
            provider="azure"
            title="Microsoft Azure"
            description="Container Apps & ACR"
            badge="1-Click SSO"
            isConnected={connections.some((c) => c.provider === "azure")}
            onConnect={() => setWizardModal("azure")}
            onSelect={() => setWizardModal("azure")}
          />

          <CloudProviderCard
            provider="digitalocean"
            title="DigitalOcean"
            description="App Platform & DOCR"
            badge="Upcoming"
            disabled={true}
          />

          <CloudProviderCard
            provider="gcp"
            title="Google Cloud"
            description="Cloud Run & Artifact Reg"
            badge="Upcoming"
            disabled={true}
          />
        </div>
      </div>

      {/* Connected Accounts List */}
      <div className="space-y-3 pt-2">
        <h2 className="text-[11px] font-mono font-medium text-zinc-500 uppercase tracking-wider flex items-center justify-between">
          <span>Connected Accounts ({connections.length})</span>
        </h2>

        {connections.length > 0 ? (
          <div className="space-y-2.5">
            {connections.map((conn) => {
              const arnText = conn.roleArn || conn.subscriptionId || "";
              return (
                <div
                  key={conn.id}
                  className="p-4 rounded-lg border border-white/[0.08] bg-[#09090b] flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono shadow-sm"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="h-8 w-8 rounded bg-zinc-900 border border-white/10 flex items-center justify-center font-bold text-xs text-white shrink-0">
                      {conn.provider === "aws" ? "AWS" : "AZ"}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-semibold text-white font-mono">
                          {conn.displayName}
                        </h4>
                        <Badge variant="success" dot className="text-[10px] py-0 px-1.5">
                          Active
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <span className="truncate max-w-xs sm:max-w-md text-zinc-400">
                          {arnText}
                        </span>
                        {arnText && (
                          <button
                            onClick={() => copyToClipboard(arnText, conn.id)}
                            className="text-zinc-500 hover:text-white transition-colors"
                            title="Copy ARN"
                          >
                            {copiedId === conn.id ? (
                              <Check className="h-3 w-3 text-white" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDisconnect(conn.id)}
                      className="text-xs h-7 px-2.5 text-zinc-400 hover:text-rose-300 hover:bg-rose-500/10 font-mono"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      <span>Disconnect</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center rounded-lg border border-dashed border-white/10 bg-[#09090b]/40 space-y-2 font-mono">
            <Cloud className="h-6 w-6 text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-400">
              No cloud accounts connected yet. Connect an AWS or Azure account above to get started.
            </p>
          </div>
        )}
      </div>

      {/* Modals for Connect Wizards */}
      {wizardModal === "aws" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <AwsConnectWizard
            onConnected={handleConnectSuccess}
            onCancel={() => setWizardModal(null)}
          />
        </div>
      )}

      {wizardModal === "azure" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <AzureConnectWizard
            onConnected={handleConnectSuccess}
            onCancel={() => setWizardModal(null)}
          />
        </div>
      )}
    </div>
  );
}

export default function CloudConnectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 font-mono text-zinc-400 text-xs">
          <Spinner size="md" />
        </div>
      }
    >
      <CloudConnectionsContent />
    </Suspense>
  );
}

