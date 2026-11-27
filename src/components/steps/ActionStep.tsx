"use client";

import { useEffect, useRef, useState } from "react";
import { schedulerEmbed } from "@/lib/embeds";

/** An external action, usually booking the kickoff call.
 *
 *  A link from Calendly, HubSpot Meetings or a Google Calendar appointment
 *  schedule is shown inline, so the client books without leaving the portal.
 *  Anything else stays a button that opens a new tab. Which hosts may be
 *  framed is decided in lib/embeds.ts and enforced by the CSP. */
export default function ActionStep({
  label,
  url,
  note,
  onBooked,
}: {
  label: string;
  url: string;
  note: string;
  /** Called when an embedded Calendly booking completes. */
  onBooked?: () => void;
}) {
  const embed = url ? schedulerEmbed(url) : null;
  const [src, setSrc] = useState("");
  const onBookedRef = useRef(onBooked);
  onBookedRef.current = onBooked;

  // The frame is mounted on the client only. Calendly wants to know the page
  // it is embedded in (embed_domain) before it will report a booking back,
  // and the host is only known in the browser; building the URL here also
  // avoids loading the calendar twice.
  useEffect(() => {
    if (!embed) return;
    if (embed.provider === "calendly") {
      const withDomain = new URL(embed.src);
      withDomain.searchParams.set("embed_domain", window.location.host);
      setSrc(withDomain.toString());
    } else {
      setSrc(embed.src);
    }
  }, [embed?.src, embed?.provider]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calendly announces a completed booking to the parent page. Only messages
  // from calendly.com itself are trusted; any other frame could post the same
  // shape to tick the step off.
  useEffect(() => {
    if (embed?.provider !== "calendly") return;
    function onMessage(event: MessageEvent) {
      if (event.origin !== "https://calendly.com") return;
      const data = event.data as { event?: string } | null;
      if (data && typeof data === "object" && data.event === "calendly.event_scheduled") onBookedRef.current?.();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embed?.provider]);

  if (!url) {
    return (
      <div>
        <p className="text-sm text-[var(--muted)]">
          No link has been added for this step yet. We will be in touch to arrange it — mark the step complete once it is booked.
        </p>
        {note && <p className="help mt-3 max-w-lg">{note}</p>}
      </div>
    );
  }

  if (!embed) {
    return (
      <div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-light">
          {label} ↗
        </a>
        {note && <p className="help mt-3 max-w-lg">{note}</p>}
      </div>
    );
  }

  return (
    <div>
      {/* Schedulers draw their own light background, so they sit in a light
          card rather than over the portal's near-black. */}
      <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-white" style={{ height: 700 }}>
        {src ? (
          <iframe
            src={src}
            title="Book the kickoff call"
            className="w-full h-full block"
            loading="lazy"
            // No allow-top-navigation: a framed page can never redirect the
            // portal itself. Popups stay allowed for "add to calendar" and
            // sign-in flows, which open in their own window.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        ) : null}
      </div>
      <p className="help mt-3">
        Calendar not loading?{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-white">
          Open it in a new tab ↗
        </a>
      </p>
      {embed.provider === "calendly" ? (
        <p className="help mt-1.5 max-w-lg">Once you book, this step ticks itself off.</p>
      ) : (
        note && <p className="help mt-1.5 max-w-lg">{note}</p>
      )}
    </div>
  );
}
