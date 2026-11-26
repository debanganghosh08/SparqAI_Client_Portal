"use client";

import { useState } from "react";

export default function ClientFeedback({ initialRating = 0, initialComment = "" }: { initialRating?: number; initialComment?: string }) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (rating < 1 || rating > 5) return setMessage("Choose a rating from 1 to 5 first.");
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, comment }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(response.ok ? "Thanks — your feedback was shared with the Sparq Labs team." : data.error || "Could not save feedback.");
  }

  return <form onSubmit={save} className="card p-5 lg:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4"><div><p className="eyebrow mb-2">Your feedback</p><h2 className="text-lg font-semibold">How is the work going?</h2><p className="text-xs text-[var(--muted)] mt-1">Your rating is visible to the Sparq Labs team.</p></div>{rating > 0 && <span className="chip chip-done">Saved · {rating}/5</span>}</div>
    <div className="flex gap-2 mb-4" role="radiogroup" aria-label="Rate your experience">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} out of 5`} onClick={() => setRating(n)} className="text-2xl transition-transform hover:scale-110" style={{ color: n <= rating ? "var(--accent)" : "#514f49" }}>★</button>)}</div>
    <label className="label" htmlFor="portal-feedback">Optional note</label><textarea id="portal-feedback" className="input min-h-20 resize-y" maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What is working well? What should we improve?" />
    <div className="flex flex-wrap items-center gap-3 mt-3"><button disabled={busy || rating < 1} className="btn btn-light btn-sm">{busy ? "Saving…" : rating > 0 ? "Save rating" : "Select a rating"}</button>{message && <span aria-live="polite" className="text-xs text-[var(--muted)]">{message}</span>}</div>
  </form>;
}
