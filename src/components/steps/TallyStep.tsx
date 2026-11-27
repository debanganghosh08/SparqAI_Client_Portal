"use client";

import { useEffect, useRef } from "react";

/** A Tally form shown in place of a built-in one, when an admin has pasted a
 *  Tally link for this step in Admin → Settings → Tally forms.
 *
 *  The answers go to Tally, not to this portal: the admin's Intake tab says so
 *  rather than showing blank fields. Submitting ticks the step off, because
 *  Tally tells the parent page when a form inside it is sent. */
export default function TallyStep({
  src,
  openUrl,
  title,
  onSubmitted,
}: {
  src: string;
  openUrl: string;
  title: string;
  onSubmitted: () => void;
}) {
  const onSubmittedRef = useRef(onSubmitted);
  onSubmittedRef.current = onSubmitted;

  // Tally posts its events as a JSON string. Only messages from tally.so are
  // trusted; any other frame could post the same text to tick the step off.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== "https://tally.so") return;
      let data: unknown = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (data && typeof data === "object" && (data as { event?: string }).event === "Tally.FormSubmitted") {
        onSubmittedRef.current();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div>
      {/* Tally's own light background, in a light card. A transparent form on
          this dark theme would be dark text on near-black. */}
      <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-white" style={{ height: 720 }}>
        <iframe
          src={src}
          title={title}
          className="w-full h-full block"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
      <p className="help mt-3">
        Form not loading?{" "}
        <a href={openUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-white">
          Open it in a new tab ↗
        </a>{" "}
        — then come back and mark this step complete.
      </p>
    </div>
  );
}
