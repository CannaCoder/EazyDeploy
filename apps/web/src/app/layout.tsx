import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../providers";

export const metadata: Metadata = {
  title: "Shipora — Zero Conflicts. One Click Deploy.",
  description:
    "AI Deployment Engineer for modern multi-service monorepos on AWS ECS with automated conflict guarding and rollback.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/30">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
