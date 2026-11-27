/** What an admin typed, turned into a link or rejected. A bare `figma.com/x`
 *  has no scheme, so `safeHref` would discard it and the save would report
 *  success with an empty link; completing it to https is what the person meant.
 *  Returns null when the value cannot be made into a safe link at all. */
export function normalizeHref(value: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) || raw.startsWith("//") ? raw.replace(/^\/\//, "https://") : `https://${raw}`;
  const safe = safeHref(withScheme);
  return safe || null;
}

/** A link we are willing to put in an href. Anything that is not plain http or
 *  https is dropped: a `javascript:` or `data:` URL in a deliverable link runs
 *  in the reader's session the moment they click it, and deliverable links are
 *  typed by one person and clicked by another. */
export function safeHref(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

/** For the few places where portal text is interpolated into Markdown that is
 *  later rendered as HTML. Settings are admin-typed, not code, so they are
 *  escaped before they can become tags. */
export function escapeHtml(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** A post-login redirect target that cannot leave the portal. `//evil.com` and
 *  `https://evil.com` are both absolute to a browser, so only a single-slash
 *  path is accepted. */
export function safeNextPath(value: string | null | undefined): string {
  const raw = String(value ?? "");
  return raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/";
}
