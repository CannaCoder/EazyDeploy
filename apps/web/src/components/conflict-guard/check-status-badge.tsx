import React from "react";
import { Badge, Spinner } from "@shipora/ui";
import { CheckCircle2, XCircle } from "lucide-react";

export function CheckStatusBadge({
  status,
}: {
  status: "running" | "passed" | "failed" | string;
}) {
  if (status === "passed") {
    return (
      <Badge variant="success" className="gap-1.5 py-1 px-2.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        <span>Passed</span>
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1.5 py-1 px-2.5">
        <XCircle className="h-3.5 w-3.5 text-rose-400" />
        <span>Failed</span>
      </Badge>
    );
  }

  return (
    <Badge variant="warning" className="gap-1.5 py-1 px-2.5">
      <Spinner size="sm" />
      <span>Running</span>
    </Badge>
  );
}
