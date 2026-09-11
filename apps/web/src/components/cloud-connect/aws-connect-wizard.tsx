"use client";

import React, { useState } from "react";
import {
  Key,
  Shield,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  Sparkles,
  Globe,
  Lock,
} from "lucide-react";
import { Button, Spinner } from "@shipora/ui";

export interface AwsConnectWizardProps {
  onConnected?: (connection: any) => void;
  onCancel?: () => void;
}

const AWS_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia) — us-east-1" },
  { value: "us-east-2", label: "US East (Ohio) — us-east-2" },
  { value: "us-west-1", label: "US West (N. California) — us-west-1" },
  { value: "us-west-2", label: "US West (Oregon) — us-west-2" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai) — ap-south-1" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore) — ap-southeast-1" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo) — ap-northeast-1" },
  { value: "eu-west-1", label: "Europe (Ireland) — eu-west-1" },
  { value: "eu-central-1", label: "Europe (Frankfurt) — eu-central-1" },
];

export function AwsConnectWizard({ onConnected, onCancel }: AwsConnectWizardProps) {
  const [tab, setTab] = useState<"keys" | "role">("keys");

  // Direct Keys State
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [displayName, setDisplayName] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  // Role ARN State
  const [roleArn, setRoleArn] = useState("");
  const [externalId] = useState(() => "shipora-ext-" + Math.random().toString(36).slice(2, 10));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedData, setConnectedData] = useState<any | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const handleConnectKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedKey = accessKeyId.trim();
    const trimmedSecret = secretAccessKey.trim();

    if (!trimmedKey || !trimmedSecret) {
      setError("Please provide both AWS Access Key ID and Secret Access Key.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/cloud-connect/aws/connect-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKeyId: trimmedKey,
          secretAccessKey: trimmedSecret,
          region,
          displayName: displayName.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to verify AWS credentials.");
      }

      setConnectedData(data.connection);
      onConnected?.(data.connection);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let resolvedRoleArn = roleArn.trim();
    if (/^\d{12}$/.test(resolvedRoleArn)) {
      resolvedRoleArn = `arn:aws:iam::${resolvedRoleArn}:role/ShiporaDeployRole`;
    }

    if (!resolvedRoleArn.startsWith("arn:aws:iam::")) {
      setError("Please enter a valid 12-digit AWS Account ID or full IAM Role ARN.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/cloud-connect/aws/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleArn: resolvedRoleArn,
          externalId,
          displayName: displayName.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not verify IAM Role.");
      }

      setConnectedData(data.connection);
      onConnected?.(data.connection);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-xl border border-white/10 bg-[#09090b] space-y-6 max-w-xl mx-auto shadow-2xl animate-in fade-in duration-200">
      {/* Wizard Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center font-bold text-xs font-mono text-white">
            AWS
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white font-mono flex items-center gap-2">
              <span>Connect Amazon Web Services</span>
              <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-normal">
                Direct Setup
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Deploy static websites and containerized services directly to your AWS cloud.
            </p>
          </div>
        </div>
      </div>

      {connectedData ? (
        /* SUCCESS VIEW */
        <div className="p-6 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-center space-y-4 animate-in fade-in">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-white font-mono">
              AWS Account Connected!
            </h4>
            <p className="text-xs text-zinc-400">
              Successfully authenticated and secured with AES-256 encryption.
            </p>
          </div>

          <div className="p-3 bg-black/60 rounded-lg border border-white/10 text-left font-mono text-xs space-y-1.5 text-zinc-300">
            <div className="flex justify-between">
              <span className="text-zinc-500">Display Name:</span>
              <span className="text-white">{connectedData.displayName}</span>
            </div>
            {connectedData.region && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Region:</span>
                <span className="text-white">{connectedData.region}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-zinc-500">Status:</span>
              <span className="text-emerald-400 font-semibold">Active</span>
            </div>
          </div>

          <Button
            size="sm"
            onClick={onCancel}
            className="w-full bg-white hover:bg-zinc-200 text-black font-semibold font-mono text-xs h-9 cursor-pointer"
          >
            Done
          </Button>
        </div>
      ) : (
        <>
          {/* Method Tabs */}
          <div className="grid grid-cols-2 p-1 bg-zinc-900 rounded-lg border border-white/10 text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setTab("keys");
                setError(null);
              }}
              className={`py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === "keys"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Key className="h-3.5 w-3.5" />
              <span>IAM Access Keys (Direct)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("role");
                setError(null);
              }}
              className={`py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === "role"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>IAM Role ARN</span>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {tab === "keys" && (
            <form onSubmit={handleConnectKeys} className="space-y-4">
              <div className="p-3 rounded-lg bg-black border border-white/[0.08] space-y-1 text-xs text-zinc-400 font-mono">
                <div className="flex items-center gap-1.5 text-white font-medium">
                  <Lock className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Encrypted Credentials at Rest</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Your credentials are encrypted using AES-256-GCM and verified directly via AWS STS.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300 font-mono flex items-center justify-between">
                    <span>AWS Access Key ID *</span>
                    <span className="text-[10px] text-zinc-500 font-normal">e.g. AKIA...</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    value={accessKeyId}
                    onChange={(e) => setAccessKeyId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-white/15 text-white font-mono text-xs placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300 font-mono">
                    AWS Secret Access Key *
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? "text" : "password"}
                      required
                      placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                      value={secretAccessKey}
                      onChange={(e) => setSecretAccessKey(e.target.value)}
                      className="w-full h-9 pl-3 pr-10 rounded-lg bg-zinc-900 border border-white/15 text-white font-mono text-xs placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300 font-mono">
                      Default Region
                    </label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-white cursor-pointer"
                    >
                      {AWS_REGIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300 font-mono">
                      Account Label (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Production AWS"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-white/15 text-white font-mono text-xs placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-zinc-900/50 rounded-lg border border-white/5 space-y-1 text-[11px] font-mono text-zinc-400">
                <p className="text-white font-medium flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  <span>How to create IAM Access Keys:</span>
                </p>
                <ol className="list-decimal list-inside space-y-0.5 text-zinc-400 pl-1">
                  <li>Open AWS Console → <strong>IAM</strong> → <strong>Users</strong></li>
                  <li>Select your user → <strong>Security credentials</strong> → <strong>Create access key</strong></li>
                  <li>Attach <code>AmazonS3FullAccess</code> (for static sites) or <code>AmazonECSFullAccess</code></li>
                </ol>
              </div>

              <div className="flex items-center justify-between pt-2">
                {onCancel && (
                  <Button variant="ghost" size="sm" type="button" onClick={onCancel} className="font-mono text-xs cursor-pointer">
                    Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  type="submit"
                  disabled={loading}
                  className="font-mono text-xs ml-auto flex items-center gap-1.5 bg-white text-black hover:bg-zinc-200 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Spinner size="sm" />
                      <span>Verifying via AWS STS...</span>
                    </>
                  ) : (
                    <>
                      <Key className="h-3.5 w-3.5" />
                      <span>Verify & Connect AWS</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {tab === "role" && (
            <form onSubmit={handleConnectRole} className="space-y-4">
              <div className="p-3 rounded-lg bg-black border border-white/[0.08] space-y-1 text-xs text-zinc-400 font-mono">
                <p className="text-white font-medium">Cross-Account IAM Role Delegation</p>
                <p className="text-[11px]">
                  Provide a cross-account role ARN that allows EazyDeploy to deploy into your AWS infrastructure without storing access keys.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300 font-mono">
                    IAM Role ARN *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="arn:aws:iam::123456789012:role/ShiporaDeployRole"
                    value={roleArn}
                    onChange={(e) => setRoleArn(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-white/15 text-white font-mono text-xs placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300 font-mono">
                    Account Label (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AWS Production Role"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-white/15 text-white font-mono text-xs placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {onCancel && (
                  <Button variant="ghost" size="sm" type="button" onClick={onCancel} className="font-mono text-xs cursor-pointer">
                    Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  type="submit"
                  disabled={loading}
                  className="font-mono text-xs ml-auto flex items-center gap-1.5 bg-white text-black hover:bg-zinc-200 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Spinner size="sm" />
                      <span>Verifying IAM Role...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="h-3.5 w-3.5" />
                      <span>Verify & Connect Role</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
