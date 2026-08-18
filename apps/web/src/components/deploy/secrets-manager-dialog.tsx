"use client";

import React, { useState } from "react";
import { trpc } from "../../lib/trpc";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Spinner,
} from "@shipora/ui";
import {
  KeyRound,
  ShieldCheck,
  UploadCloud,
  CheckCircle2,
  Lock,
  X,
  FileText,
  AlertCircle,
} from "lucide-react";

export interface SecretsManagerDialogProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
  detectedEnvVars?: string[];
}

export function SecretsManagerDialog({
  projectId,
  projectName,
  isOpen,
  onClose,
  detectedEnvVars = [],
}: SecretsManagerDialogProps) {
  const [rawEnv, setRawEnv] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: secretData, isLoading: loadingKeys, refetch } =
    trpc.project.getSecretKeys.useQuery(
      { projectId },
      { enabled: isOpen }
    );

  const saveMutation = trpc.project.saveSecrets.useMutation({
    onSuccess: () => {
      setSaveSuccess(true);
      setErrorMsg(null);
      refetch();
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err) => {
      setErrorMsg(err.message || "Failed to save secrets to AWS Secrets Manager");
    },
  });

  if (!isOpen) return null;

  const configuredKeys = secretData?.keys || [];
  const handleSave = () => {
    if (!rawEnv.trim()) return;
    saveMutation.mutate({
      projectId,
      rawEnv,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawEnv(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-card border border-border/70 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Environment Secrets
              </h3>
              <p className="text-xs text-muted-foreground">
                AWS Secrets Manager • {projectName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-accent/40 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Security Notice */}
          <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 flex items-start gap-3">
            <Lock className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-white">
                Encrypted at rest (AES-256)
              </span>
              <p className="text-muted-foreground leading-relaxed">
                Secrets are stored directly inside AWS Secrets Manager and passed as encrypted
                <code className="text-violet-300 font-mono px-1 py-0.5 mx-1 bg-background/50 rounded">
                  valueFrom
                </code>
                references to ECS Fargate. Shipora never logs or saves values in plaintext.
              </p>
            </div>
          </div>

          {/* Configured Keys Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">
                Configured Secret Keys
              </span>
              <span className="text-muted-foreground">
                {configuredKeys.length} secret(s) in AWS
              </span>
            </div>

            {loadingKeys ? (
              <div className="flex items-center justify-center py-4">
                <Spinner size="sm" />
              </div>
            ) : configuredKeys.length === 0 ? (
              <p className="text-xs text-muted-foreground italic p-3 bg-background/40 rounded-lg border border-border/40">
                No secrets stored in AWS Secrets Manager yet for this project.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-background/50 border border-border/40 max-h-32 overflow-y-auto">
                {configuredKeys.map((key) => {
                  const isRequired = detectedEnvVars.includes(key);
                  return (
                    <Badge
                      key={key}
                      variant="outline"
                      className="font-mono text-[11px] gap-1 bg-background/70 border-border/60 text-white"
                    >
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      <span>{key}</span>
                      {isRequired && (
                        <span className="text-[9px] text-violet-400 font-sans ml-1">
                          [required]
                        </span>
                      )}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* .env Input Form */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-white">
                Upload or Paste .env Configuration
              </label>
              <label className="cursor-pointer text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1">
                <UploadCloud className="h-3.5 w-3.5" />
                <span>Upload .env file</span>
                <input
                  type="file"
                  accept=".env,.env.*,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              value={rawEnv}
              onChange={(e) => setRawEnv(e.target.value)}
              placeholder="DATABASE_URL=postgres://...\nJWT_SECRET=your-secret\nNEXT_PUBLIC_API_URL=https://..."
              rows={6}
              className="w-full rounded-xl bg-background/60 border border-border/60 p-3 font-mono text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all resize-none"
            />
          </div>

          {/* Feedback banners */}
          {saveSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Secrets successfully synchronized to AWS Secrets Manager!</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-400">
              <AlertCircle className="h-4 w-4" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/40 bg-card/50 flex items-center justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>

          <Button
            onClick={handleSave}
            disabled={!rawEnv.trim() || saveMutation.isPending}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white gap-2"
          >
            {saveMutation.isPending ? (
              <>
                <Spinner size="sm" />
                Saving to AWS...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Encrypt & Save Secrets
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
