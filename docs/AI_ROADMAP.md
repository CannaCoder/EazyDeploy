# 🤖 Shipora AI Deployment Intelligence Roadmap

This document outlines the architecture and future rollout of **AI-Assisted Deployment & Intelligent Diagnostics** for Shipora.

---

## 1. Vision & Overview

Shipora aims to act as an **Autonomous DevOps & Deployment Engineer**. By integrating LLM-driven intelligence, Shipora eliminates configuration friction for both public repository pastes and complex enterprise monorepos.

```
                  ┌─────────────────────────────────────────┐
                  │          Git Repository Input           │
                  │    (GitHub App, URL Paste, or SSH)      │
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │      Shipora AI Deployment Agent        │
                  │   • Codebase & topology reasoning       │
                  │   • Framework & build script synthesis  │
                  │   • Zero-config environment inference   │
                  │   • Anomaly & rollback root cause       │
                  └───────┬─────────────────────────┬───────┘
                          │                         │
            Static & Client Apps             Backend Workloads & APIs
                          ▼                         ▼
                 [ AWS S3 / CloudFront ]       [ ECS Fargate / ACA ]
```

---

## 2. Core Capabilities to Introduce

### Phase A: Zero-Config Codebase Reasoning (LLM Inspection)
* **How it works**: For any repository (without Dockerfiles or standard configs), the agent inspects the file tree, package manifests, and entry files.
* **Outputs**:
  - Automatically identifies whether an app is **Static HTML/CSS**, **Client SPA (React/Vue/Vite/Svelte)**, **Fullstack SSR (Next.js/Remix/Nuxt)**, or **Backend API (Node/FastAPI/Go/Rust)**.
  - Determines exact output folders (`dist/`, `build/`, `out/`, `.next/`).
  - Infers required ports and routing fallback rules (e.g., SPA `/* -> index.html` redirects).

### Phase B: Automated Environment & Missing File Synthesis
* **Auto-Generated Dockerfiles / Nginx Configs**: Generates optimized multi-stage build configurations tailored specifically to the project's dependencies and Node/Python versions.
* **Auto-Generating Missing Production Assets**:
  - Generates sensible default `robots.txt`, `sitemap.xml`, and security headers (`Content-Security-Policy`, `X-Frame-Options`).
  - Identifies placeholder `.env.example` configurations and prompts the user for only the strictly necessary values.

### Phase C: Intelligent Health Check & Rollback Diagnostics
* When a deployment fails a health check or runtime probe:
  - The AI agent inspects CloudWatch / Azure / SSE deployment logs.
  - Extracts the exact stack trace or missing secret name (e.g. `Error: DATABASE_URL is not set`).
  - Explains the failure in plain English to the user with actionable next steps.

---

## 3. Implementation Plan

1. **AI Activity Worker (`apps/temporal-worker/src/activities/ai-analyze-repo.ts`)**:
   - Integrates Gemini / LLM SDK.
   - Takes file tree summary & sample entry files.
   - Returns structured `ServiceManifest` proposal.
2. **Dashboard UI Integration (`apps/web`)**:
   - Displays AI explanation badge: `"Detected as Static Vite SPA. Suggested deployment target: AWS S3 + CloudFront."`
   - Gives users a 1-click **"Deploy with AI Recommended Defaults"** button.
