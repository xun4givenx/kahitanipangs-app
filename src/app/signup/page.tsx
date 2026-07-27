"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Activity, ArrowRight, ShieldCheck, Wallet } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Account created! Setting up defaults...");
    await seedDefaults();
    router.push("/");
    router.refresh();
  }

  async function seedDefaults() {
    const res = await fetch("/api/seed", { method: "POST" });
    if (!res.ok) console.error("Failed to seed defaults");
  }

  return (
    <div className="flex min-h-screen w-full bg-background flex-row-reverse">
      {/* Right Panel: Graphic/Brand (Hidden on mobile) */}
      <div className="relative hidden w-1/2 lg:block">
        <Image
          src="/auth-bg.png"
          alt="Abstract financial background"
          fill
          className="object-cover opacity-90 scale-x-[-1]"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        <div className="absolute inset-0 bg-background/20 backdrop-blur-[2px]" />
        
        <div className="absolute bottom-12 left-12 right-12 z-10 text-white">
          <div className="flex items-center gap-2 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Kahitanipangs</h1>
          </div>
          <h2 className="text-4xl font-medium leading-tight mb-4 tracking-tight">
            Start scaling your lending <br />
            operations today.
          </h2>
          <div className="flex gap-6 mt-8 opacity-80">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Bank-grade security</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Real-time tracking</span>
            </div>
          </div>
        </div>
      </div>

      {/* Left Panel: Signup Form */}
      <div className="flex w-full flex-col items-center justify-center p-8 lg:w-1/2 xl:p-24 relative overflow-hidden">
        {/* Subtle background glow on the form side */}
        <div className="absolute -top-[20%] -left-[20%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
        
        <div className="w-full max-w-[400px] space-y-8 relative z-10">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight">Create Account</h2>
            <p className="text-muted-foreground mt-2">
              Start managing your money today.
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-12 bg-muted/40 backdrop-blur-sm border-border/50 focus-visible:ring-primary focus-visible:border-primary transition-all"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 bg-muted/40 backdrop-blur-sm border-border/50 focus-visible:ring-primary focus-visible:border-primary transition-all"
                minLength={6}
                required
              />
            </div>
            
            <Button type="submit" className="w-full h-12 text-md font-medium group" disabled={loading}>
              {loading ? "Creating account..." : (
                <>
                  Sign up
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
