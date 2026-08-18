import React from "react";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { Zap, Github } from "lucide-react";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@shipora/ui";

export default function SignInPage() {
  const hasClerk = Boolean(process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 mx-auto flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sign in to Shipora</h1>
          <p className="text-sm text-muted-foreground">
            Zero-conflict AI deployment orchestrator
          </p>
        </div>

        {hasClerk ? (
          <div className="flex justify-center">
            <SignIn />
          </div>
        ) : (
          <Card className="bg-card/70 border-border/60">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-base text-white">Developer Access</CardTitle>
              <CardDescription>
                Sign in with GitHub to access your workspace and projects.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/dashboard" className="block">
                <Button className="w-full bg-white text-black hover:bg-slate-200 gap-2 h-10 font-medium">
                  <Github className="h-4 w-4" />
                  Continue with GitHub
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
