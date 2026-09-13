import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Providers } from "../providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#08090d",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Shipora — Zero-Conflict Multi-Service Cloud Deployments",
  description:
    "Autonomous deployment orchestrator for modern multi-service monorepos. Tree-sitter static AST analysis, deterministic lockfile conflict guarding, and 2-minute AWS ECS rollback.",
  keywords: [
    "monorepo deployment",
    "zero-conflict deploy",
    "AWS ECS Fargate",
    "turborepo continuous delivery",
    "docker auto-build",
    "automated rollback",
  ],
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider dynamic>
      <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
        <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
