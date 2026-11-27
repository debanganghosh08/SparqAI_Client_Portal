"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/url";
import Logo from "./Logo";
import PasswordInput from "./PasswordInput";

const STEPS = [
  { n: "01", title: "Onboard once", text: "Two forms and an upload. Everything we need, collected in one pass instead of six emails." },
  { n: "02", title: "Watch it move", text: "A live board of every deliverable, with a status you can read without asking anyone." },
  { n: "03", title: "Take the keys", text: "The handoff pack: every file, link, and login from the engagement, yours to keep." },
];

export default function LoginPanel({ portalName, tagline, supportEmail }: { portalName: string; tagline: string; supportEmail: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAttemptsRemaining(null);
    setRetryAfterSeconds(0);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      setAttemptsRemaining(Number.isInteger(data.attemptsRemaining) ? Number(data.attemptsRemaining) : null);
      setRetryAfterSeconds(Number(data.retryAfterSeconds) || 0);
      return;
    }
    // ?next= comes from the URL bar, so it is only ever a path inside the
    // portal: an absolute one would turn our login page into a redirector
    // somebody else can point anywhere.
    const next = safeNextPath(params.get("next"));
    router.push(data.mustReset ? "/set-password" : data.role === "admin" ? "/admin" : next);
    router.refresh();
  }

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Left: the entryway */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#0d0d0c] border-r border-[var(--border)] px-14 py-12">
        <div aria-hidden className="pointer-events-none absolute -top-48 -left-40 w-[620px] h-[620px] rounded-full opacity-[0.10]" style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 62%)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-64 -right-40 w-[560px] h-[560px] rounded-full opacity-[0.12]" style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 60%)" }} />
        {/* The colonnade: the entryway the product is named after. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.22]"
          style={{ backgroundImage: "url(/brand/colonnade.jpg)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, #0d0d0c 0%, rgba(13,13,12,0.55) 38%, rgba(13,13,12,0.86) 78%, #0d0d0c 100%)" }}
        />

        <div className="fade-up relative">
          <Logo size={30} name={portalName} />
        </div>

        <div className="max-w-md relative">
          <p className="eyebrow mb-5 fade-up" style={{ animationDelay: "0.1s" }}>Client Portal</p>
          <h1 className="text-[2.6rem] leading-[1.08] font-bold mb-4 title-grad fade-up" style={{ animationDelay: "0.18s" }}>
            {tagline}
          </h1>
          <p className="text-sm leading-relaxed text-[var(--muted)] mb-11 fade-up" style={{ animationDelay: "0.26s" }}>
            Everything for your project in one place: what we need from you, what we are building, and exactly where it stands.
          </p>
          <div className="space-y-6">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex gap-5 fade-up" style={{ animationDelay: `${0.34 + i * 0.09}s` }}>
                <span className="mono pt-1">{s.n}</span>
                <div>
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="text-xs mt-1 leading-relaxed text-[var(--muted)]">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The footer line that sat here ("Questions? <email>") was removed at
            Dai's request. The spacer keeps justify-between from dropping the
            copy above to the bottom edge of the panel. */}
        <div aria-hidden className="h-4" />
      </div>

      {/* Right: sign in */}
      <div className="min-h-screen flex items-center justify-center px-6 py-14">
        <div className="w-full max-w-sm fade-up">
          <div className="lg:hidden flex justify-center mb-10">
            <Logo size={58} name={portalName} stacked />
          </div>
          <div className="card p-8">
            <h2 className="text-xl font-semibold">Welcome back</h2>
            <p className="text-sm mt-1.5 mb-7 text-[var(--muted)]">Sign in with the details we sent you.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="input" autoFocus autoComplete="username" />
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <PasswordInput id="password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" autoComplete="current-password" />
              </div>
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              {attemptsRemaining !== null && attemptsRemaining > 0 && <p className="text-xs text-[var(--muted)]">{attemptsRemaining} sign-in attempt{attemptsRemaining === 1 ? "" : "s"} remaining before a 15-minute lockout.</p>}
              {retryAfterSeconds > 0 && <p className="text-xs text-[var(--muted)]">Try again in about {Math.ceil(retryAfterSeconds / 60)} minute{Math.ceil(retryAfterSeconds / 60) === 1 ? "" : "s"}.</p>}
              <button type="submit" disabled={loading} className="btn btn-primary w-full py-3 mt-1">
                {loading ? "Signing in…" : "Enter the portal"}
              </button>
            </form>
          </div>
          {/* Only when a real address is set in Admin → Settings: a help line
              pointing at a placeholder inbox is worse than no help line. */}
          {supportEmail && (
            <p className="text-xs text-center mt-6 leading-relaxed text-[var(--faint)]">
              Trouble signing in? Email{" "}
              <a href={`mailto:${supportEmail}`} className="underline underline-offset-2 hover:text-neutral-300">{supportEmail}</a>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
