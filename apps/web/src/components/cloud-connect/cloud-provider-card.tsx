"use client";

import React from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@shipora/ui";
import type { CloudProvider } from "@shipora/types";

export interface CloudProviderCardProps {
  provider: CloudProvider;
  title: string;
  description: string;
  badge?: string;
  isConnected?: boolean;
  isSelected?: boolean;
  disabled?: boolean;
  onSelect?: (provider: CloudProvider) => void;
  onConnect?: (provider: CloudProvider) => void;
}

export function CloudProviderCard({
  provider,
  title,
  description,
  badge,
  isConnected,
  isSelected,
  disabled,
  onSelect,
  onConnect,
}: CloudProviderCardProps) {
  const isAws = provider === "aws";
  const isAzure = provider === "azure";

  const handleCardClick = () => {
    if (disabled) return;
    if (onSelect) {
      onSelect(provider);
    } else if (onConnect && !isConnected) {
      onConnect(provider);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`relative p-4 sm:p-5 rounded-lg border transition-all select-none flex flex-col justify-between h-full ${
        disabled
          ? "opacity-40 cursor-not-allowed bg-[#070709] border-white/[0.04]"
          : isSelected
          ? "bg-[#0e0e11] border-white/40 shadow-md ring-1 ring-white/30 cursor-pointer"
          : "bg-[#09090b] border-white/[0.08] hover:border-white/20 hover:bg-[#0d0d10] cursor-pointer"
      }`}
    >
      <div className="space-y-3">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {/* Minimalist Provider Monogram */}
            <div className="h-8 w-8 rounded bg-zinc-900 border border-white/10 flex items-center justify-center font-mono font-bold text-[11px] text-white">
              {isAws ? "AWS" : isAzure ? "AZ" : provider === "digitalocean" ? "DO" : "GCP"}
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-white font-mono flex items-center gap-1.5">
                <span>{title}</span>
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5">{description}</p>
            </div>
          </div>

          {badge && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.04] text-zinc-300 shrink-0">
              {badge}
            </span>
          )}
        </div>

        {/* Level 2 Managed note */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 pt-1">
          <ShieldCheck className="h-3.5 w-3.5 text-zinc-300" />
          <span>IAM Ephemeral Tokens</span>
        </div>
      </div>

      {/* Footer Status & Action */}
      <div className="pt-3 mt-4 border-t border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isConnected ? "bg-white" : "bg-zinc-600"
            }`}
          />
          <span className="text-[11px] font-mono text-zinc-400">
            {isConnected ? "Connected" : disabled ? "Coming Soon" : "Not connected"}
          </span>
        </div>

        {!isConnected && !disabled && onConnect && (
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={(e) => {
              e.stopPropagation();
              onConnect(provider);
            }}
            className="text-xs h-7 px-2.5 font-mono gap-1 cursor-pointer"
          >
            <span>Connect</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

