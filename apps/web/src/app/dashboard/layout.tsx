import React from "react";
import Link from "next/link";
import {
  Zap,
  LayoutDashboard,
  FolderGit2,
  Rocket,
  Shield,
  Settings,
  Plus,
} from "lucide-react";
import { Button, Avatar } from "@shipora/ui";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/50 bg-card/40 flex flex-col justify-between p-4 shrink-0">
        <div>
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 px-3 py-4 mb-6">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-md shadow-violet-500/20">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">
              Shipora
            </span>
          </Link>

          {/* Nav items */}
          <nav className="space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-accent/60 text-white"
            >
              <LayoutDashboard className="h-4 w-4 text-violet-400" />
              <span>Overview</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-white hover:bg-accent/40 transition-colors"
            >
              <FolderGit2 className="h-4 w-4" />
              <span>Projects</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-white hover:bg-accent/40 transition-colors"
            >
              <Rocket className="h-4 w-4" />
              <span>Deployments</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-white hover:bg-accent/40 transition-colors"
            >
              <Shield className="h-4 w-4" />
              <span>Conflict Guard</span>
            </Link>
          </nav>
        </div>

        {/* Bottom CTA & User profile */}
        <div className="space-y-4 pt-4 border-t border-border/40">
          <Link href="/dashboard/new-project" className="block">
            <Button className="w-full justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>

          <div className="flex items-center gap-3 px-2 py-1">
            <Avatar fallback="DEV" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-white truncate">
                Developer
              </span>
              <span className="text-[11px] text-muted-foreground truncate">
                developer@shipora.dev
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-border/40 px-8 flex items-center justify-between bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">Workspace</span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs text-muted-foreground">Production</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Cloud Engine Ready
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
