"use client";

import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function safeReturnTo(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Sign in failed.");
        return;
      }

      window.location.href = safeReturnTo(returnTo);
    } catch {
      setError("Sign in failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-panel">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
            <ShieldCheck size={19} />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-950">HappyTides Ops</div>
            <div className="text-xs text-slate-500">Secure owner access</div>
          </div>
        </div>
        <h1 className="mt-8 text-2xl font-semibold text-slate-950">Sign in</h1>
        <p className="mt-2 text-sm text-slate-500">Access sales, inventory, customers, and analytics.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="email">Email</label>
            <Input
              autoComplete="email"
              className="mt-2"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@happytides.co"
              required
              type="email"
              value={email}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="password">Password</label>
            <Input
              autoComplete="current-password"
              className="mt-2"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              required
              type="password"
              value={password}
            />
          </div>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <Button className="w-full" disabled={submitting} type="submit">
            {submitting ? "Signing in" : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
