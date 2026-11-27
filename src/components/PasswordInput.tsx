"use client";

import { useState } from "react";

/** A password field with a reveal toggle.
 *
 *  One-time passwords get copied by hand off a screen or out of a message, so
 *  a client typing one blind gets it wrong and blames the portal. The toggle
 *  is local state only: the value is never stored, sent anywhere, or logged,
 *  and it resets to hidden on every mount, so a reload never leaves a password
 *  visible on a shared screen. */
export default function PasswordInput({ className = "input", style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false);
  const label = shown ? "Hide password" : "Show password";
  return (
    <div className="relative">
      <input
        {...props}
        type={shown ? "text" : "password"}
        className={className}
        // `.input` is unlayered CSS in globals.css, so a Tailwind padding
        // utility loses to its own `padding` and the text runs under the
        // button. Inline padding is the one thing that reliably wins.
        style={{ paddingRight: 44, ...style }}
      />
      <button
        type="button"
        onClick={() => setShown((value) => !value)}
        aria-label={label}
        aria-pressed={shown}
        title={label}
        className="absolute right-0 top-0 h-full px-3 flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] transition-colors"
      >
        {shown ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 3l18 18" />
            <path d="M10.7 6.1A10.6 10.6 0 0 1 12 6c6.6 0 10.2 6 10.2 6a18.4 18.4 0 0 1-2.8 3.6" />
            <path d="M6.7 7.7A17.4 17.4 0 0 0 1.8 12S5.4 18 12 18c1.6 0 3-.3 4.3-.8" />
            <path d="M9.9 10a3 3 0 0 0 4.2 4.3" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M1.8 12S5.4 6 12 6s10.2 6 10.2 6-3.6 6-10.2 6S1.8 12 1.8 12Z" />
            <circle cx="12" cy="12" r="3.1" />
          </svg>
        )}
      </button>
    </div>
  );
}
