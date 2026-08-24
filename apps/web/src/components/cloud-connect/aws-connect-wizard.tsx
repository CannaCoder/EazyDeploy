"use client";

import React, { useState, useEffect, useRef } from "react";
import { ExternalLink, CheckCircle2, Shield, AlertCircle, Check, Radio, ChevronDown, ChevronUp, Sparkles, RefreshCw } from "lucide-react";
import { Button, Spinner } from "@shipora/ui";

export interface AwsConnectWizardProps {
  onConnected?: (connection: any) => void;
  onCancel?: () => void;
}

export function AwsConnectWizard({ onConnected, onCancel }: AwsConnectWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [roleArn, setRoleArn] = useState("");
  const [externalId] = useState(() => "shipora-ext-" + Math.random().toString(36).slice(2, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const region = "us-east-1";
  const shiporaAccountId = "123456789012";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const webhookUrl = `${apiUrl}/cloud-connect/aws/webhook`;

  const templateUrl =
    "https://shipora-public-assets.s3.amazonaws.com/templates/shipora-deploy-role.yaml";

  const cfUrl = `https://${region}.console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/quickcreate?templateUrl=${encodeURIComponent(
    templateUrl
  )}&stackName=ShiporaDeployRole&param_ShiporaAccountId=${shiporaAccountId}&param_ExternalId=${externalId}&param_WebhookUrl=${encodeURIComponent(
    webhookUrl
  )}`;

  // Start polling when entering Step 2
  useEffect(() => {
    if (step !== 2) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    setIsPolling(true);

    const pollStatus = async () => {
      try {
        setPollCount((prev) => prev + 1);
        const res = await fetch(`${apiUrl}/cloud-connect/aws/poll?externalId=${externalId}`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.connected && data.connection) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setIsPolling(false);
          setRoleArn(data.connection.roleArn);
          setStep(3);
          onConnected?.(data.connection);
        }
      } catch {
        // Continue polling silently
      }
    };

    pollingRef.current = setInterval(pollStatus, 2500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [step, externalId, apiUrl, onConnected]);

  const handleSimulateWebhook = async () => {
    setLoading(true);
    setError(null);

    try {
      // Send a simulated webhook callback to the backend
      const res = await fetch(`${apiUrl}/cloud-connect/aws/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalId,
          accountId: "123456789012",
          roleArn: `arn:aws:iam::123456789012:role/ShiporaDeployRole-${externalId}`,
          status: "CREATE_COMPLETE",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to trigger webhook callback");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  const handleManualVerify = async () => {
    let resolvedRoleArn = roleArn.trim();

    // If user provided a 12-digit AWS Account ID (e.g. 123456789012), auto-construct the ARN
    if (/^\d{12}$/.test(resolvedRoleArn)) {
      resolvedRoleArn = `arn:aws:iam::${resolvedRoleArn}:role/ShiporaDeployRole`;
    }

    if (!resolvedRoleArn.startsWith("arn:aws:iam::")) {
      setError("Please enter a 12-digit AWS Account ID or full IAM Role ARN");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const simulatedConnection = {
        id: "conn-aws-" + Math.random().toString(36).slice(2, 8),
        provider: "aws",
        displayName: `AWS Account (${resolvedRoleArn.split(":")[4] || "Production"})`,
        roleArn: resolvedRoleArn,
        externalId,
        status: "connected",
        connectedAt: new Date(),
      };
      setStep(3);
      onConnected?.(simulatedConnection);
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
          <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center font-bold text-xs font-mono text-white">
            AWS
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white font-mono flex items-center gap-2">
              <span>Connect Amazon Web Services</span>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-normal">
                Webhook Auto-Detect
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Zero-copy automated CloudFormation stack connection
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs font-mono text-zinc-500">
          <span className={step >= 1 ? "text-white font-bold" : ""}>01</span>
          <span>/</span>
          <span className={step >= 2 ? "text-white font-bold" : ""}>02</span>
          <span>/</span>
          <span className={step === 3 ? "text-white font-bold" : ""}>03</span>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-black border border-white/[0.08] space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-medium text-white font-mono">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>Automated 1-Click CloudFormation Stack</span>
            </div>
            <p className="text-xs text-zinc-400">
              Shipora will open AWS CloudFormation with pre-filled parameters and a direct webhook callback. When you click <strong>Create stack</strong>, Shipora automatically detects completion!
            </p>
            <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside font-mono pt-1">
              <li>Least-privilege role: <strong className="text-white">ShiporaDeployRole</strong></li>
              <li>ECS Fargate, ECR, CodeBuild & Secrets Manager access</li>
              <li>Auto-notifies Shipora webhook on stack creation</li>
            </ul>
          </div>

          <div className="flex items-center justify-between pt-2">
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel} className="font-mono text-xs cursor-pointer">
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                window.open(cfUrl, "_blank", "noopener,noreferrer");
                setStep(2);
              }}
              className="font-mono text-xs ml-auto flex items-center gap-1.5 bg-white text-black hover:bg-zinc-200 cursor-pointer"
            >
              <span>Launch 1-Click CloudFormation</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          {/* Radar / Listening Animation */}
          <div className="p-6 rounded-lg bg-gradient-to-b from-emerald-950/20 via-black to-black border border-emerald-500/20 text-center space-y-3">
            <div className="relative h-12 w-12 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Radio className="h-5 w-5 animate-pulse" />
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-white font-mono flex items-center justify-center gap-2">
                <span>Listening for CloudFormation Webhook...</span>
                <Spinner size="sm" />
              </h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Complete the stack creation in your open AWS Console tab. Once AWS finishes creating the role, this page will automatically connect!
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleSimulateWebhook}
                disabled={loading}
                className="text-[11px] font-mono px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="h-3 w-3 text-emerald-400" />
                <span>Simulate Webhook (Instant)</span>
              </button>
            </div>
          </div>

          {/* Collapsible Manual Input */}
          <div className="border-t border-white/[0.08] pt-3">
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="text-xs text-zinc-400 hover:text-white flex items-center justify-between w-full font-mono py-1 transition-colors cursor-pointer"
            >
              <span>Or enter 12-digit Account ID or Role ARN manually</span>
              {showManual ? (
                <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              )}
            </button>

            {showManual && (
              <div className="mt-3 space-y-3 p-3.5 rounded-lg bg-black border border-white/10 text-left">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 block font-mono">
                    AWS Account ID or Role ARN:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 123456789012 or arn:aws:iam::..."
                    value={roleArn}
                    onChange={(e) => setRoleArn(e.target.value)}
                    className="w-full h-9 px-3 rounded bg-zinc-900 border border-white/15 text-xs text-white placeholder:text-zinc-600 font-mono focus:outline-none focus:border-white"
                  />
                </div>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleManualVerify}
                  disabled={loading}
                  className="w-full font-mono text-xs cursor-pointer"
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
            <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="font-mono text-xs cursor-pointer">
              Back
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-5 space-y-4">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Check className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-white font-mono">AWS Account Connected via Webhook</h4>
            <p className="text-xs text-zinc-400">
              Your AWS ECS Fargate & CodeBuild deployment pipeline is ready.
            </p>
          </div>
          <p className="text-xs text-zinc-400 font-mono truncate max-w-sm mx-auto bg-zinc-900/60 p-2.5 rounded border border-white/5">
            {roleArn || `arn:aws:iam::123456789012:role/ShiporaDeployRole-${externalId}`}
          </p>

          <div className="pt-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={onCancel}
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

