"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap,
  LayoutDashboard,
  FolderGit2,
  Settings,
  Plus,
  Menu,
  X,
} from "lucide-react";
import { Button, Avatar } from "@shipora/ui";

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/dashboard", icon: FolderGit2 },
  { label: "Cloud Accounts", href: "/dashboard/settings/cloud-connections", icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#000000] text-zinc-100 selection:bg-white selection:text-black">
      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar (Desktop + Mobile Slide-over) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 border-r border-white/[0.08] bg-[#09090b] flex flex-col justify-between p-4 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Logo & Mobile Close */}
          <div className="flex items-center justify-between px-2 py-2 mb-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="h-7 w-7 rounded bg-white flex items-center justify-center">
                <Zap className="h-4 w-4 text-black fill-black" />
              </div>
              <span className="font-bold text-sm tracking-tight text-white font-mono">
                Shipora
              </span>
            </Link>

            <button
              onClick={() => setMobileDrawerOpen(false)}
              className="lg:hidden p-1 rounded border border-white/10 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Workspace Switcher Pill */}
          <div className="mx-1 mb-6 p-2 rounded border border-white/[0.08] bg-black flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-5 w-5 rounded bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] font-mono text-white font-bold shrink-0">
                P
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-white truncate">Production</p>
                <p className="text-[10px] font-mono text-zinc-500 truncate">us-east-1</p>
              </div>
            </div>
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>

          {/* Navigation Links */}
          <nav className="space-y-0.5 font-mono text-xs">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded font-medium transition-colors ${
                    isActive
                      ? "bg-white text-black font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom CTA & Profile Card */}
        <div className="space-y-3 pt-3 border-t border-white/[0.08]">
          <Link href="/dashboard/new-project" onClick={() => setMobileDrawerOpen(false)} className="block">
            <Button variant="primary" size="sm" className="w-full justify-center gap-1.5 font-mono text-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Connect Repo</span>
            </Button>
          </Link>

          <div className="flex items-center gap-2.5 px-1 py-1">
            <Avatar fallback="DV" className="h-7 w-7 text-[10px] bg-zinc-800 border-white/10 text-white" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-white truncate font-mono">
                Developer
              </span>
              <span className="text-[10px] text-zinc-500 truncate font-mono">
                dev@shipora.cloud
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-white/[0.08] px-4 sm:px-6 flex items-center justify-between bg-[#000000]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-1.5 rounded border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white mr-1"
            >
              <Menu className="h-3.5 w-3.5" />
            </button>

            <span className="text-zinc-500">workspace</span>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-200 font-medium">production</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-white/10 bg-white/[0.03] text-[11px] font-mono text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              <span>ECS Ready</span>
            </div>
          </div>
        </header>

        {/* Dynamic Route Children */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
