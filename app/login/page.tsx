"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message ?? "Could not sign in.");

      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const nextPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/";
      window.location.assign(nextPath);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 md:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden min-h-[560px] flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white md:flex">
          <div className="absolute inset-y-0 right-0 w-1.5 bg-teal-500" />
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-300">Traffic Control</p>
            <h1 className="mt-5 max-w-sm text-4xl font-bold leading-tight">Management System</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">Traffic fleet, camera, driver, and violation operations in one workspace.</p>
          </div>
          <div className="border-t border-slate-700 pt-5 text-xs text-slate-400">
            <p>Administration Panel</p>
            <p className="mt-1">Secure access for authorized staff</p>
          </div>
        </section>

        <section className="flex min-h-[560px] flex-col justify-center px-6 py-10 sm:px-12">
          <div className="mx-auto w-full max-w-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-800">Administrator access</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Sign in</h2>
            <p className="mt-2 text-sm text-slate-500">Use your configured administrator credentials.</p>

            {error && <p role="alert" className="mt-6 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p>}

            <form onSubmit={signIn} className="mt-7 space-y-5">
              <label className="block text-sm font-semibold text-slate-700">
                Username
                <input autoComplete="username" autoFocus required value={username} onChange={(event) => setUsername(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100" placeholder="Administrator username" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Password
                <span className="mt-1.5 flex overflow-hidden rounded-md border border-slate-300 focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-100">
                  <input autoComplete="current-password" required type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="min-w-0 flex-1 px-3 py-2.5 text-sm font-normal outline-none" placeholder="Enter password" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="border-l border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">{showPassword ? "Hide" : "Show"}</button>
                </span>
              </label>
              <button type="submit" disabled={submitting} className="w-full rounded-md bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-wait disabled:opacity-60">
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>
            <p className="mt-6 text-center text-xs text-slate-400">Authorized staff only</p>
          </div>
        </section>
      </div>
    </main>
  );
}