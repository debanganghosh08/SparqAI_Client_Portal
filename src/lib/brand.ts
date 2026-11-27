// Sparq Labs defaults. Everything here is overridable at runtime from
// Admin → Settings; these values are the fallbacks for a fresh install.

export const BRAND = {
  name: "Sparq Labs",
  tagline: "Your GTM work, clearly in view.",
  description:
    "The Sparq Labs client portal for project progress, campaign reporting, deliverables, files, and messages.",
  // Empty, not a placeholder. A fake address was shown on the login screen to
  // every visitor; with nothing set, the lines that mention it are hidden.
  supportEmail: "",
  site: "https://github.com/",
  /** Coal, ink, and one warm stone accent. */
  colors: { coal: "#0b0b0a", ink: "#f4f3ef", accent: "#d8cfc0" },
} as const;

/** Runtime-editable settings, with their defaults and how the admin UI labels them. */
export const SETTINGS_SCHEMA = [
  {
    group: "Brand",
    keys: [
      { key: "portal_name", label: "Portal name", help: "Shown in the sidebar, the login screen, and every email-style message.", default: BRAND.name },
      { key: "portal_tagline", label: "Tagline", help: "One line under the wordmark on the login screen.", default: BRAND.tagline },
      { key: "accent_color", label: "Accent colour", help: "Hex value used for progress, focus rings, and the active state.", default: BRAND.colors.accent, type: "color" },
      { key: "support_email", label: "Support email", help: "Where clients are told to reach you. Until this is set, the login screen, Messages and the handoff pack simply do not mention an email.", default: BRAND.supportEmail },
    ],
  },
  {
    group: "Client journey",
    keys: [
      { key: "welcome_headline", label: "Welcome headline", help: "The first line a new client reads on the intro screen.", default: "Welcome. Here is how we will work together." },
      { key: "welcome_body", label: "Welcome body", help: "A short paragraph under the headline.", default: "Everything for your project lives in this portal: what we need from you, what we are building, and where it stands. Work through it in order — the next module unlocks as you finish the one before it.", type: "textarea" },
      { key: "kickoff_url", label: "Kickoff booking link", help: "Calendly, HubSpot Meetings or a Google Calendar appointment schedule appear inline in the step, and a Calendly booking ticks the step off by itself. For Google, use Share → Website embed (calendar.google.com/calendar/appointments/schedules/…): Google will not let any site embed the short calendar.app.google link. Any other link shows as a button.", default: "" },
      { key: "resources_url", label: "Resources link", help: "Optional link to a shared drive, notion, or handbook.", default: "" },
    ],
  },
  {
    group: "Tally forms",
    keys: [
      { key: "tally_business_url", label: "About your business", help: "Paste a Tally share link (tally.so/r/…) to use your Tally form for this step instead of the built-in one. Answers then live in Tally, not in the client's Intake tab. Add hidden fields named email, name and company to the Tally form so each response arrives labelled with the client who sent it. Leave blank to keep the built-in form.", default: "" },
      { key: "tally_project_url", label: "Goals and scope", help: "As above, for the Goals and scope step.", default: "" },
      { key: "tally_feedback_url", label: "Consolidated feedback", help: "As above, for the feedback step in The build.", default: "" },
    ],
  },
] as const;

/** A support address worth showing a client, or "" when the setting is empty
 *  or still a placeholder. example.com/.org/.net and the reserved test
 *  domains were never anybody's inbox. */
export function realEmail(value: string | null | undefined): string {
  const email = String(value ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  const domain = (email.split("@").pop() ?? "").toLowerCase();
  if (/^example\.(com|org|net)$/.test(domain)) return "";
  if (/\.(test|invalid|example|localhost)$/.test(domain)) return "";
  return email;
}

export const SETTING_DEFAULTS: Record<string, string> = Object.fromEntries(
  SETTINGS_SCHEMA.flatMap((g) => g.keys.map((k) => [k.key, k.default]))
);
