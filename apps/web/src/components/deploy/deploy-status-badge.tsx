import React from "react";
import { Badge, Spinner } from "@shipora/ui";
import { CheckCircle2, XCircle, Clock, RotateCcw, AlertTriangle, Activity } from "lucide-react";

export function DeployStatusBadge({
  status,
  isStatic,
}: {
  status: "pending" | "building" | "deploying" | "verifying" | "rolling_back" | "success" | "failed" | "rolled_back" | string;
  isStatic?: boolean;
}) {
  if (status === "success") {
    return (
      <Badge variant="success" className="gap-1.5 py-1 px-2.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        <span>Live & Healthy</span>
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1.5 py-1 px-2.5">
        <XCircle className="h-3.5 w-3.5 text-rose-400" />
        <span>Deploy Failed</span>
      </Badge>
    );
  }

  if (status === "rolled_back") {
    return (
      <Badge variant="warning" className="gap-1.5 py-1 px-2.5 bg-violet-500/10 text-violet-400 border-violet-500/20">
        <RotateCcw className="h-3.5 w-3.5 text-violet-400" />
        <span>Rolled Back</span>
      </Badge>
    );
  }

  if (status === "building") {
    return (
      <Badge variant="warning" className="gap-1.5 py-1 px-2.5 bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
        <Spinner size="sm" />
        <span>{isStatic ? "Packaging Assets" : "Building Containers"}</span>
      </Badge>
    );
  }

  if (status === "deploying") {
    return (
      <Badge variant="warning" className="gap-1.5 py-1 px-2.5 bg-violet-500/10 text-violet-400 border-violet-500/20">
        <Spinner size="sm" />
        <span>Provisioning</span>
      </Badge>
    );
  }

  if (status === "verifying") {
    return (
      <Badge className="gap-1.5 py-1 px-2.5 bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
        <Activity className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
        <span>Verifying Health</span>
      </Badge>
    );
  }

  if (status === "rolling_back") {
    return (
      <Badge className="gap-1.5 py-1 px-2.5 bg-amber-500/10 text-amber-400 border-amber-500/20">
        <RotateCcw className="h-3.5 w-3.5 text-amber-400 animate-spin" />
        <span>Rolling Back</span>
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1.5 py-1 px-2.5">
      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{status}</span>
    </Badge>
  );
}
