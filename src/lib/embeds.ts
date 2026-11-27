// Third-party pages the portal is willing to show inside itself.
//
// Two things use this list and must agree: the step components, which decide
// whether a pasted link becomes an inline frame or stays a plain link, and the
// Content-Security-Policy in middleware.ts, which is what actually enforces it.
// A host that is not here can never be framed, whatever an admin pastes.
//
// Pure functions, no server imports: the edge middleware reads this file too.

export const FRAME_ORIGINS = [
  "https://calendly.com",
  "https://calendar.google.com",
  "https://meetings.hubspot.com",
  "https://tally.so",
] as const;

export type SchedulerEmbed = { src: string; provider: "calendly" | "google" | "hubspot" };

function parseHttps(value: string): URL | null {
  try {
    const url = new URL(String(value ?? "").trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** A booking link turned into something that can be framed, or null when it
 *  cannot be - in which case the step keeps its ordinary button.
 *
 *  Google is the one to watch. Its short `calendar.app.google/...` sharing
 *  links refuse to be framed; only the "Website embed" form,
 *  `calendar.google.com/calendar/appointments/schedules/...`, works inline. A
 *  short link is therefore left as a button rather than shown as a broken
 *  frame. */
export function schedulerEmbed(value: string): SchedulerEmbed | null {
  const url = parseHttps(value);
  if (!url) return null;
  const host = url.hostname.toLowerCase();

  if (host === "calendly.com" || host === "www.calendly.com") {
    if (url.pathname.split("/").filter(Boolean).length === 0) return null;
    const src = new URL(`https://calendly.com${url.pathname}`);
    url.searchParams.forEach((v, k) => src.searchParams.set(k, v));
    src.searchParams.set("embed_type", "Inline");
    src.searchParams.set("hide_gdpr_banner", "1");
    return { src: src.toString(), provider: "calendly" };
  }

  if (host === "calendar.google.com" && url.pathname.startsWith("/calendar/appointments/schedules/")) {
    const src = new URL(`https://calendar.google.com${url.pathname}`);
    src.searchParams.set("gv", "true");
    return { src: src.toString(), provider: "google" };
  }

  if (host === "meetings.hubspot.com" && url.pathname.split("/").filter(Boolean).length > 0) {
    const src = new URL(`https://meetings.hubspot.com${url.pathname}`);
    src.searchParams.set("embed", "true");
    return { src: src.toString(), provider: "hubspot" };
  }

  return null;
}

/** A Tally share link (`tally.so/r/abc123`) or embed link turned into the
 *  embed URL the step frames, plus the plain link for the "open in a new tab"
 *  fallback. Null for anything that is not a Tally form, which leaves the
 *  built-in form in place.
 *
 *  `hidden` rides along as query parameters. Tally reads them into any hidden
 *  fields of the same name, which is how a submission is tied to the client
 *  who made it: one Tally form is shared by every client, so without these the
 *  responses would arrive anonymous. Values a form does not define are
 *  ignored by Tally. */
export function tallyEmbed(value: string, hidden: Record<string, string>): { embed: string; open: string } | null {
  const url = parseHttps(value);
  if (!url || url.hostname.toLowerCase() !== "tally.so") return null;
  const match = /^\/(?:r|embed)\/([A-Za-z0-9]+)\/?$/.exec(url.pathname);
  if (!match) return null;

  const embed = new URL(`https://tally.so/embed/${match[1]}`);
  const open = new URL(`https://tally.so/r/${match[1]}`);
  // Deliberately NOT transparentBackground: Tally's default text is dark, and
  // on this portal's near-black background it would be unreadable. The form
  // keeps its own light background inside a framed card instead.
  embed.searchParams.set("alignLeft", "1");
  embed.searchParams.set("hideTitle", "1");
  for (const [k, v] of Object.entries(hidden)) {
    if (!v) continue;
    embed.searchParams.set(k, v);
    open.searchParams.set(k, v);
  }
  return { embed: embed.toString(), open: open.toString() };
}
