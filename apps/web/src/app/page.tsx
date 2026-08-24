"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button, Badge } from "@shipora/ui";
import {
  ShieldCheck,
  Zap,
  ArrowRight,
  GitBranch,
  RotateCcw,
  Boxes,
  Terminal,
  Cpu,
  CheckCircle2,
  Lock,
  Layers,
  Server,
  Cloud,
  Check,
  Copy,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { ThreeCanvasTopology } from "../components/3d/three-canvas-topology";
import { TiltCard } from "../components/3d/tilt-card";
import { InteractiveDeploySimulator } from "../components/landing/interactive-deploy-simulator";
import { BorderBeam } from "../components/ui/border-beam";

export default function LandingPage() {
  const [copiedCli, setCopiedCli] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleCopyCli = () => {
    navigator.clipboard.writeText("pnpm dlx shipora@latest init");
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  return (
    <div className="relative min-h-screen bg-[#000000] text-zinc-100 selection:bg-white selection:text-black overflow-x-hidden">
      {/* Subtle Geometric Platinum Grid */}
      <div className="fixed inset-0 bg-grid-platinum pointer-events-none opacity-50" />

      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#000000]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo & System Badge */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="h-7 w-7 rounded bg-white flex items-center justify-center">
                <Zap className="h-4 w-4 text-black fill-black" />
              </div>
              <span className="font-bold text-sm tracking-tight text-white font-mono">
                Shipora
              </span>
            </Link>

            <span className="text-zinc-700 hidden sm:inline">/</span>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              <span>v2.4.0 · Live</span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-mono text-zinc-400">
            <a href="#topology" className="hover:text-white transition-colors">
              Topology
            </a>
            <a href="#testbed" className="hover:text-white transition-colors">
              Testbed
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Architecture
            </a>
            <a href="#comparison" className="hover:text-white transition-colors">
              Comparison
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-2.5">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white font-mono text-xs">
                Dashboard
              </Button>
            </Link>
            <Link href="/dashboard/new-project">
              <Button variant="primary" size="sm" className="font-mono text-xs gap-1.5">
                <span>Deploy Now</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {/* Mobile Burger Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-down Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/[0.08] bg-[#000000] px-6 py-4 space-y-3 font-mono text-xs">
            <a
              href="#topology"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-zinc-300 hover:text-white"
            >
              Topology
            </a>
            <a
              href="#testbed"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-zinc-300 hover:text-white"
            >
              Testbed
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-zinc-300 hover:text-white"
            >
              Architecture
            </a>
            <a
              href="#comparison"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-zinc-300 hover:text-white"
            >
              Comparison
            </a>
            <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2">
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="secondary" size="sm" className="w-full justify-center">
                  Dashboard
                </Button>
              </Link>
              <Link href="/dashboard/new-project" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" size="sm" className="w-full justify-center">
                  Deploy Now
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-white/10 bg-white/[0.03] text-zinc-300 text-xs font-mono mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            <span>AST PARSER · CONFLICT GUARD · 2-MIN ROLLBACK</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.08]">
            Zero-conflict deployments for multi-service monorepos.
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed mb-8">
            Shipora parses your workspace AST, validates lockfiles and secrets before cloud execution, and deploys to AWS ECS with 2-minute deterministic rollback.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto justify-center">
            <Link href="/dashboard/new-project" className="w-full sm:w-auto">
              <Button size="lg" variant="primary" className="w-full sm:w-auto font-mono text-xs px-6 gap-2">
                <span>Connect Repository</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>

            {/* 1-Click Copy CLI Pill */}
            <div
              onClick={handleCopyCli}
              className="w-full sm:w-auto flex items-center justify-between gap-3 px-4 py-2 rounded border border-white/10 bg-[#09090b] hover:bg-[#121214] cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
                <Terminal className="h-3.5 w-3.5 text-zinc-400" />
                <span>pnpm dlx shipora init</span>
              </div>
              <div className="text-zinc-500 group-hover:text-zinc-300">
                {copiedCli ? <Check className="h-3.5 w-3.5 text-white" /> : <Copy className="h-3.5 w-3.5" />}
              </div>
            </div>
          </div>
        </div>

        {/* 3D WebGL Monorepo Topology Showcase */}
        <div id="topology" className="relative scroll-mt-20">
          <ThreeCanvasTopology />
        </div>
      </section>

      {/* Metrics Bar */}
      <section className="border-y border-white/[0.08] bg-[#070709] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-0.5">
              <p className="text-2xl sm:text-3xl font-bold font-mono text-white">0</p>
              <p className="text-xs font-mono text-zinc-500">Lockfile Merge Failures</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-2xl sm:text-3xl font-bold font-mono text-white">&lt; 12s</p>
              <p className="text-xs font-mono text-zinc-500">AST Discovery Duration</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-2xl sm:text-3xl font-bold font-mono text-white">2 Min</p>
              <p className="text-xs font-mono text-zinc-500">Autonomous Rollback</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-2xl sm:text-3xl font-bold font-mono text-white">100%</p>
              <p className="text-xs font-mono text-zinc-500">AWS ECS Fargate Native</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Deploy Simulator Section */}
      <section id="testbed" className="py-20 max-w-5xl mx-auto px-4 sm:px-6 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
            Interactive Testbed
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
            Simulate your pipeline in action.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
            Test how Shipora handles clean monorepo builds, catches breaking dependency conflicts, and executes instantaneous rollbacks.
          </p>
        </div>

        <InteractiveDeploySimulator />
      </section>

      {/* 3D Tilt Feature Grid */}
      <section id="features" className="py-20 max-w-6xl mx-auto px-4 sm:px-6 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
            Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
            Built specifically for monorepo scale.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
            Deterministic static analysis eliminates fragile shell scripts and broken releases.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Card 1 */}
          <TiltCard>
            <div>
              <div className="h-9 w-9 rounded bg-white flex items-center justify-center text-black mb-4">
                <Boxes className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                AST ENGINE
              </span>
              <h3 className="text-lg font-bold text-white mt-1 mb-2">
                Zero-Config Service Discovery
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Inspects your workspace dependency graph, package manifests, and code syntax to detect Next.js, Vite, Fastify, and FastAPI apps without manual YAML configurations.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-[11px] font-mono text-zinc-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              <span>Turborepo, pnpm workspaces, Nx supported</span>
            </div>
          </TiltCard>

          {/* Card 2 */}
          <TiltCard>
            <div>
              <div className="h-9 w-9 rounded bg-white flex items-center justify-center text-black mb-4">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                CONFLICT GUARD
              </span>
              <h3 className="text-lg font-bold text-white mt-1 mb-2">
                Pre-Flight Lockfile & Secret Audits
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Verifies lockfile SHA checksums, branch protection sync, and required environment variables before building container images.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-[11px] font-mono text-zinc-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              <span>Zero broken cloud deployments</span>
            </div>
          </TiltCard>

          {/* Card 3 */}
          <TiltCard>
            <div>
              <div className="h-9 w-9 rounded bg-white flex items-center justify-center text-black mb-4">
                <RotateCcw className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                SAFETY PROTOCOL
              </span>
              <h3 className="text-lg font-bold text-white mt-1 mb-2">
                2-Minute Deterministic Rollbacks
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Pins previous ECS task definitions live. If post-deploy health check probes fail, traffic shifts back automatically without human intervention.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-[11px] font-mono text-zinc-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              <span>Zero dropped packets on release</span>
            </div>
          </TiltCard>

          {/* Card 4 */}
          <TiltCard>
            <div>
              <div className="h-9 w-9 rounded bg-white flex items-center justify-center text-black mb-4">
                <Lock className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                SECURITY
              </span>
              <h3 className="text-xl font-bold text-white mt-1 mb-2">
                Ephemeral AWS STS AssumeRole
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Zero long-lived cloud credentials stored. Shipora authenticates using short-lived IAM roles and OIDC tokens for maximum compliance.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-[11px] font-mono text-zinc-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              <span>SOC2 & ISO 27001 compatible IAM</span>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* Comparison Section */}
      <section id="comparison" className="py-20 max-w-5xl mx-auto px-4 sm:px-6 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
            Comparison
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
            Why teams replace custom CI scripts.
          </h2>
        </div>

        <div className="rounded border border-white/[0.08] bg-[#09090b] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/[0.08] bg-[#000000] text-zinc-400">
                  <th className="p-4 sm:p-5 font-medium">CAPABILITY</th>
                  <th className="p-4 sm:p-5 font-semibold text-white">SHIPORA</th>
                  <th className="p-4 sm:p-5 font-medium text-zinc-500">GENERIC CI/CD</th>
                  <th className="p-4 sm:p-5 font-medium text-zinc-500">CUSTOM SCRIPTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-zinc-300">
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Monorepo AST Parsing</td>
                  <td className="p-4 sm:p-5 text-white font-bold">✔ Automatic AST</td>
                  <td className="p-4 sm:p-5 text-zinc-500">✖ Manual matrices</td>
                  <td className="p-4 sm:p-5 text-zinc-500">✖ Fragile grep scripts</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Lockfile Conflict Guard</td>
                  <td className="p-4 sm:p-5 text-white font-bold">✔ Pre-flight SHA Check</td>
                  <td className="p-4 sm:p-5 text-zinc-500">✖ Fails at build time</td>
                  <td className="p-4 sm:p-5 text-zinc-500">✖ Unchecked</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">ECS Auto-Rollback</td>
                  <td className="p-4 sm:p-5 text-white font-bold">✔ Autonomous &lt; 2m</td>
                  <td className="p-4 sm:p-5 text-zinc-500">✖ Manual rollback</td>
                  <td className="p-4 sm:p-5 text-zinc-500">✖ Ad-hoc CLI rollback</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Cloud IAM Security</td>
                  <td className="p-4 sm:p-5 text-white font-bold">✔ Ephemeral STS Tokens</td>
                  <td className="p-4 sm:p-5 text-zinc-400">Static Secrets</td>
                  <td className="p-4 sm:p-5 text-zinc-500">✖ Plain env keys</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="py-20 max-w-5xl mx-auto px-4 sm:px-6 text-center">
        <div className="relative rounded-lg border border-white/[0.1] bg-[#09090b] p-10 sm:p-14 overflow-hidden shadow-2xl">
          <BorderBeam size={260} duration={14} colorFrom="rgba(255,255,255,0.25)" colorTo="transparent" />
          
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
            Deploy with zero conflicts today.
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm max-w-lg mx-auto mb-8">
            Connect your repository in under 60 seconds. Keep your existing Turborepo, pnpm, and AWS ECS setup intact.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/dashboard/new-project">
              <Button size="lg" variant="primary" className="font-mono text-xs px-6">
                Get Started
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="secondary" className="font-mono text-xs px-6">
                Open Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[#000000] py-10 text-xs font-mono text-zinc-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-white flex items-center justify-center">
              <Zap className="h-3 w-3 text-black fill-black" />
            </div>
            <span className="text-zinc-200 font-semibold">Shipora</span>
            <span>· Deterministic Cloud Deployment Orchestration</span>
          </div>

          <div className="flex items-center gap-6 text-zinc-400">
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/dashboard/new-project" className="hover:text-white transition-colors">
              New Project
            </Link>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
