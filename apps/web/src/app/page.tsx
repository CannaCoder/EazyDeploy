import Link from "next/link";
import { Button } from "@shipora/ui";
import {
  ShieldCheck,
  Zap,
  ArrowRight,
  GitBranch,
  RotateCcw,
  Boxes,
  Terminal,
  Cpu,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Background glow */}
      <div className="absolute inset-0 gradient-glow pointer-events-none" />

      {/* Navigation */}
      <header className="relative z-10 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
              Shipora
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                Dashboard
              </Button>
            </Link>
            <Link href="/dashboard/new-project">
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-500/25">
                Get Started
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-8">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>AI Deployment Engineer for Multi-Service Monorepos</span>
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-6">
          Ship confidently.{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-indigo-300 to-purple-400">
            Zero conflicts.
          </span>{" "}
          One click.
        </h1>

        <p className="max-w-2xl mx-auto text-lg sm:text-xl text-muted-foreground mb-10 leading-relaxed">
          Shipora reads your monorepo, auto-detects frameworks, verifies your lockfiles and secrets,
          and deploys to AWS ECS with 2-minute auto-rollback.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link href="/dashboard/new-project">
            <Button size="lg" className="h-12 px-8 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/30 text-base font-semibold">
              Connect Repository
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline" className="h-12 px-8 border-border/80 text-base font-semibold hover:bg-accent">
              View Dashboard
            </Button>
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="glass-panel p-6 rounded-2xl border border-border/50">
            <div className="h-10 w-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-400 mb-4">
              <Boxes className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Service Auto-Discovery</h3>
            <p className="text-sm text-muted-foreground">
              Tree-sitter static analysis parses your Next.js, Vite, Fastify, and FastAPI apps and builds optimal Docker containers.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-border/50">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-400 mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Conflict Guard</h3>
            <p className="text-sm text-muted-foreground">
              Blocks deploys if unresolved merge conflicts, lockfile mismatches, or missing secrets are detected on your protected branch.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-border/50">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 mb-4">
              <RotateCcw className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">2-Minute Auto-Rollback</h3>
            <p className="text-sm text-muted-foreground">
              Keeps previous ECS task definitions live and automatically reverts traffic if post-deploy health checks fail.
            </p>
          </div>
        </div>
      </section>

      {/* Tech Stack Banner */}
      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Shipora. Built with Turborepo, Next.js 15, Temporal Cloud, and AWS ECS Fargate.</p>
      </footer>
    </div>
  );
}
