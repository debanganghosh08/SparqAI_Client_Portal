// Portico's own defaults. Everything here is overridable at runtime from
// Admin → Settings, so a fork can be rebranded without touching code: the
// values below are only the fallbacks a fresh install starts with.

export const BRAND = {
  name: "Portico",
  tagline: "The room your clients walk into.",
  description:
    "An open-source client portal for agencies, studios, and freelancers. Onboarding, deliverables, files, and messages in one calm place.",
  supportEmail: "hello@example.com",
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
      { key: "support_email", label: "Support email", help: "Where clients are told to reach you.", default: BRAND.supportEmail },
    ],
  },
  {
    group: "Client journey",
    keys: [
      { key: "welcome_headline", label: "Welcome headline", help: "The first line a new client reads on the intro screen.", default: "Welcome. Here is how we will work together." },
      { key: "welcome_body", label: "Welcome body", help: "A short paragraph under the headline.", default: "Everything for your project lives in this portal: what we need from you, what we are building, and where it stands. Work through it in order — the next module unlocks as you finish the one before it.", type: "textarea" },
      { key: "kickoff_url", label: "Kickoff booking link", help: "Calendar link for the kickoff call step. Leave blank to hide the step's button.", default: "" },
      { key: "resources_url", label: "Resources link", help: "Optional link to a shared drive, notion, or handbook.", default: "" },
    ],
  },
] as const;

export const SETTING_DEFAULTS: Record<string, string> = Object.fromEntries(
  SETTINGS_SCHEMA.flatMap((g) => g.keys.map((k) => [k.key, k.default]))
);
