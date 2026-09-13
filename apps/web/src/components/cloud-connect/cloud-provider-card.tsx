"use client";

import React from "react";
import { ArrowRight, ShieldCheck, Check } from "lucide-react";
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

// Official Amazon Web Services Logo with Smile Vector
function AwsLogo({ className = "h-4 w-auto max-w-[26px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 304 182" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* "aws" typography in white */}
      <path
        fill="#FFFFFF"
        d="M86.4 66.4c0 3.7.4 6.7 1.1 8.9.8 2.2 1.8 4.6 3.2 7.2.5.8.7 1.6.7 2.3 0 1-.6 2-1.9 3l-6.3 4.2c-.9.6-1.8.9-2.6.9-1 0-2-.5-3-1.4-1.4-1.5-2.6-3.1-3.6-4.7-1-1.7-2-3.6-3.1-5.9-7.8 9.2-17.6 13.8-29.4 13.8-8.4 0-15.1-2.4-20-7.2-4.9-4.8-7.4-11.2-7.4-19.2 0-8.5 3-15.4 9.1-20.6 6.1-5.2 14.2-7.8 24.5-7.8 3.4 0 6.9.3 10.6.8 3.7.5 7.5 1.3 11.5 2.2v-7.3c0-7.6-1.6-12.9-4.7-16-3.2-3.1-8.6-4.6-16.3-4.6-3.5 0-7.1.4-10.8 1.3-3.7.9-7.3 2-10.8 3.4-1.6.7-2.8 1.1-3.5 1.3-.7.2-1.2.3-1.6.3-1.4 0-2.1-1-2.1-3.1v-4.9c0-1.6.2-2.8.7-3.5.5-.7 1.4-1.4 2.8-2.1 3.5-1.8 7.7-3.3 12.6-4.5 4.9-1.3 10.1-1.9 15.6-1.9 11.9 0 20.6 2.7 26.2 8.1 5.5 5.4 8.3 13.6 8.3 24.6V66.4zM45.8 81.6c3.3 0 6.7-.6 10.3-1.8 3.6-1.2 6.8-3.4 9.5-6.4 1.6-1.9 2.8-4 3.4-6.4.6-2.4 1-5.3 1-8.7v-4.2c-2.9-.7-6-1.3-9.2-1.7-3.2-.4-6.3-.6-9.4-.6-6.7 0-11.6 1.3-14.9 4-3.3 2.7-4.9 6.5-4.9 11.5 0 4.7 1.2 8.2 3.7 10.6 2.4 2.4 5.9 3.6 10.5 3.6zM126.1 92.4c-1.8 0-3-.3-3.8-1-.8-.6-1.5-2-2.1-3.9L96.7 10.2c-.6-2-.9-3.3-.9-4 0-1.6.8-2.5 2.4-2.5h9.8c1.9 0 3.2.3 3.9 1 .8.6 1.4 2 2 3.9l16.8 66.2 15.6-66.2c.5-2 1.1-3.3 1.9-3.9.8-.6 2.2-1 4-1h8c1.9 0 3.2.3 4 1 .8.6 1.5 2 1.9 3.9l15.8 67 17.3-67c.6-2 1.3-3.3 2-3.9.8-.6 2.1-1 3.9-1h9.3c1.6 0 2.5.8 2.5 2.5 0 .5-.1 1-.2 1.6-.1.6-.3 1.4-.7 2.5l-24.1 77.3c-.6 2-1.3 3.3-2.1 3.9-.8.6-2.1 1-3.8 1h-8.6c-1.9 0-3.2-.3-4-1-.8-.7-1.5-2-1.9-4L156 23l-15.4 64.4c-.5 2-1.1 3.3-1.9 4-.8.7-2.2 1-4 1H126.1zM254.6 95.1c-5.2 0-10.4-.6-15.4-1.8-5-1.2-8.9-2.5-11.5-4-1.6-.9-2.7-1.9-3.1-2.8-.4-.9-.6-1.9-.6-2.8v-5.1c0-2.1.8-3.1 2.3-3.1.6 0 1.2.1 1.8.3.6.2 1.5.6 2.5 1 3.4 1.5 7.1 2.7 11 3.5 4 .8 7.9 1.2 11.9 1.2 6.3 0 11.2-1.1 14.6-3.3 3.4-2.2 5.2-5.4 5.2-9.5 0-2.8-.9-5.1-2.7-7-1.8-1.9-5.2-3.6-10.1-5.2L246 52c-7.3-2.3-12.7-5.7-16-10.2-3.3-4.4-5-9.3-5-14.5 0-4.2.9-7.9 2.7-11.1 1.8-3.2 4.2-6 7.2-8.2 3-2.3 6.4-4 10.4-5.2 4-1.2 8.2-1.7 12.6-1.7 2.2 0 4.5.1 6.7.4 2.3.3 4.4.7 6.5 1.1 2 .5 3.9 1 5.7 1.6 1.8.6 3.2 1.2 4.2 1.8 1.4.8 2.4 1.6 3 2.5.6.8.9 1.9.9 3.3v4.7c0 2.1-.8 3.2-2.3 3.2-.8 0-2.1-.4-3.8-1.2-5.7-2.6-12.1-3.9-19.2-3.9-5.7 0-10.2.9-13.3 2.8-3.1 1.9-4.7 4.8-4.7 8.9 0 2.8 1 5.2 3 7.1 2 1.9 5.7 3.8 11 5.5l14.2 4.5c7.2 2.3 12.4 5.5 15.5 9.6 3.1 4.1 4.6 8.8 4.6 14 0 4.3-.9 8.2-2.6 11.6-1.8 3.4-4.2 6.4-7.3 8.8-3.1 2.5-6.8 4.3-11.1 5.6-4.3 1.3-9 2-14.1 2z"
      />
      {/* Official AWS Curved Smile Arrow in #FF9900 */}
      <g fill="#FF9900">
        <path d="M273.5 143.7c-32.9 24.3-80.7 37.2-121.8 37.2-57.6 0-109.5-21.3-148.7-56.7-3.1-2.8-.3-6.6 3.4-4.4 42.4 24.6 94.7 39.5 148.8 39.5 36.5 0 76.6-7.6 113.5-23.2 5.4-2.4 10.1 3.7 4.8 7.6z" />
        <path d="M287.2 128.1c-4.2-5.4-27.8-2.6-38.5-1.3-3.2.4-3.7-2.4-.8-4.5 18.8-13.2 49.7-9.4 53.3-5 3.6 4.5-1 35.4-18.6 50.2-2.7 2.3-5.3 1.1-4.1-1.9 4.7-9.9 13.6-32.2 9.4-37.5z" />
      </g>
    </svg>
  );
}

// Official Microsoft 4-Square Logo
function AzureLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" rx="1" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" rx="1" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" rx="1" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" rx="1" />
    </svg>
  );
}

// Official DigitalOcean Droplet Logo
function DigitalOceanLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12.04 0C5.41 0 .04 5.37.04 12c0 4.19 2.15 7.88 5.43 10.02l3.41-3.41C6.75 17.26 5.4 14.8 5.4 12c0-3.66 2.98-6.64 6.64-6.64 3.66 0 6.64 2.98 6.64 6.64 0 2.21-.99 4.19-2.55 5.51l-.01.01 3.42 3.42C21.84 18.8 24.04 15.65 24.04 12c0-6.63-5.37-12-12-12zm-3.44 14.54v3.66h3.66v-3.66H8.6zm3.66 3.66h3.42v3.42h-3.42V18.2z"
        fill="#0080FF"
      />
    </svg>
  );
}

// Official Google Cloud 4-Color Logo
function GcpLogo({ className = "h-5 w-5" }: { className?: string }) {
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
  const handleCardClick = () => {
    if (disabled) return;
    if (onSelect) {
      onSelect(provider);
    } else if (onConnect && !isConnected) {
      onConnect(provider);
    }
  };

  const renderLogo = () => {
    switch (provider) {
      case "aws":
        return <AwsLogo className="w-6 h-auto" />;
      case "azure":
        return <AzureLogo className="h-5 w-5" />;
      case "digitalocean":
        return <DigitalOceanLogo className="h-5 w-5" />;
      case "gcp":
        return <GcpLogo className="h-5 w-5" />;
      default:
        return null;
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative p-4 rounded-xl border transition-all duration-200 select-none flex flex-col justify-between h-full ${
        disabled
          ? "opacity-40 cursor-not-allowed bg-[#070709] border-white/[0.04]"
          : isSelected
          ? "bg-gradient-to-b from-[#18181f] to-[#0c0c10] border-white/50 shadow-xl shadow-black/50 ring-1 ring-white/30 cursor-pointer"
          : "bg-[#09090b] border-white/[0.08] hover:border-white/20 hover:bg-[#0e0e12] cursor-pointer"
      }`}
    >
      <div className="space-y-3.5">
        {/* Top Header Row: Icon + Badge / Selection Indicator */}
        <div className="flex items-center justify-between gap-2">
          {/* Brand Icon Box */}
          <div
            className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all ${
              isSelected
                ? "bg-white/10 border border-white/20 shadow-inner"
                : "bg-zinc-900/90 border border-white/10 group-hover:border-white/20 group-hover:bg-zinc-800/80"
            }`}
          >
            {renderLogo()}
          </div>

          {/* Top Right: Selected Checkmark or Auth Badge */}
          <div className="flex items-center gap-1.5">
            {badge && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors ${
                  disabled
                    ? "border-white/[0.06] bg-white/[0.02] text-zinc-500"
                    : isSelected
                    ? "border-white/25 bg-white/10 text-white font-medium"
                    : "border-white/10 bg-white/[0.04] text-zinc-400 group-hover:text-zinc-300"
                }`}
              >
                {badge}
              </span>
            )}

            {isSelected && !disabled && (
              <span className="h-5 w-5 rounded-full bg-white text-black flex items-center justify-center shrink-0 shadow-sm animate-in zoom-in-75 duration-150">
                <Check className="h-3 w-3 stroke-[3]" />
              </span>
            )}
          </div>
        </div>

        {/* Title & Service Architecture */}
        <div className="space-y-1">
          <h3
            className={`text-sm font-semibold tracking-tight leading-snug ${
              disabled ? "text-zinc-400" : "text-white"
            }`}
          >
            {title}
          </h3>
          <p className="text-[11px] text-zinc-400 font-mono leading-relaxed line-clamp-2">
            {description}
          </p>
        </div>

        {/* Security & Access Guarantee */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 pt-1">
          <ShieldCheck
            className={`h-3.5 w-3.5 shrink-0 ${
              disabled ? "text-zinc-600" : "text-emerald-400"
            }`}
          />
          <span className="truncate">IAM Ephemeral Tokens</span>
        </div>
      </div>

      {/* Footer Status & Action */}
      <div className="pt-3 mt-4 border-t border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            {isConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </>
            ) : (
              <span className="inline-flex rounded-full h-2 w-2 bg-zinc-600" />
            )}
          </span>
          <span
            className={`text-xs font-mono ${
              isConnected
                ? "text-emerald-400 font-medium"
                : disabled
                ? "text-zinc-500"
                : "text-zinc-400"
            }`}
          >
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
            className="text-xs h-7 px-2.5 font-mono gap-1 cursor-pointer bg-white hover:bg-zinc-200 text-black font-semibold rounded-md transition-all shadow-sm"
          >
            <span>Connect</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
