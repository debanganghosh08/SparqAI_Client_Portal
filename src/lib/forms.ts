// Intake forms. Each form is a list of fields; answers are stored as one JSON
// blob per (user, form) in `form_responses`, so adding a field never needs a
// migration. Drafts save as the client types; submitting completes the step.

export type FieldType = "text" | "textarea" | "email" | "url" | "select" | "multiselect" | "number";

export type Field = {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  required?: boolean;
  options?: string[];
  /** Renders two fields side by side on wide screens. */
  half?: boolean;
};

export type Form = {
  id: string;
  title: string;
  intro: string;
  fields: Field[];
};

export const FORMS: Record<string, Form> = {
  business: {
    id: "business",
    title: "About your business",
    intro: "The context we would otherwise spend the first call collecting. Rough answers beat blank ones.",
    fields: [
      { id: "legal_name", label: "Business name", type: "text", required: true, half: true, placeholder: "Northwind Studio" },
      { id: "website", label: "Website", type: "url", half: true, placeholder: "https://" },
      { id: "industry", label: "Industry", type: "text", half: true, placeholder: "Interior design" },
      { id: "team_size", label: "Team size", type: "select", half: true, options: ["Just me", "2–5", "6–20", "21–50", "50+"] },
      {
        id: "what_you_do",
        label: "What do you sell, in one paragraph?",
        type: "textarea",
        required: true,
        help: "Write it the way you would explain it to a friend, not the way it appears on your site.",
      },
      {
        id: "customer",
        label: "Who is your best customer?",
        type: "textarea",
        required: true,
        help: "The one you would take ten more of. Who they are, what they were doing before they found you.",
      },
      {
        id: "how_they_find_you",
        label: "How do customers find you today?",
        type: "multiselect",
        options: ["Referrals", "Search", "Paid ads", "Social", "Outbound", "Events", "Partnerships", "Not sure"],
      },
      { id: "competitors", label: "Who do you lose deals to?", type: "textarea", help: "Names or links. Tell us what they do better." },
    ],
  },
  project: {
    id: "project",
    title: "Goals and scope",
    intro: "What we are aiming at, how we will know we hit it, and what is deliberately out of scope.",
    fields: [
      {
        id: "objective",
        label: "What has to be true when this is done?",
        type: "textarea",
        required: true,
        help: "One or two sentences. The outcome, not the deliverable.",
      },
      {
        id: "success_metric",
        label: "How will you measure that?",
        type: "text",
        required: true,
        placeholder: "e.g. 20 qualified enquiries a month",
      },
      { id: "deadline", label: "Any hard deadline?", type: "text", half: true, placeholder: "e.g. trade show on 3 March" },
      { id: "budget_band", label: "Budget band", type: "select", half: true, options: ["Under $5k", "$5k–$15k", "$15k–$50k", "$50k+", "Prefer not to say"] },
      {
        id: "in_scope",
        label: "In scope",
        type: "textarea",
        help: "The pieces you expect us to deliver.",
      },
      {
        id: "out_of_scope",
        label: "Explicitly out of scope",
        type: "textarea",
        help: "The fastest way to prevent a difficult conversation in week six.",
      },
      {
        id: "decision_makers",
        label: "Who signs off?",
        type: "text",
        required: true,
        help: "Name and role of everyone whose approval a deliverable needs.",
      },
      { id: "risks", label: "What could derail this?", type: "textarea", help: "Internal politics, a pending rebrand, a migration, a person on leave." },
    ],
  },
  feedback: {
    id: "feedback",
    title: "Consolidated feedback",
    intro: "Collect your team's notes, then send them once. Scattered feedback is the most expensive thing in a project.",
    fields: [
      {
        id: "overall",
        label: "Overall reaction",
        type: "select",
        required: true,
        options: ["On the money", "Close, needs refinement", "Right direction, wrong execution", "Not what we expected"],
      },
      { id: "keep", label: "What should we keep?", type: "textarea", required: true, help: "Be specific. Naming what works stops us from changing it." },
      { id: "change", label: "What needs to change?", type: "textarea", required: true, help: "One change per line, with the reason behind it." },
      { id: "blockers", label: "Anything blocking approval?", type: "textarea" },
      { id: "reviewers", label: "Who reviewed this round?", type: "text", placeholder: "Names or roles" },
    ],
  },
};

export function getForm(id: string): Form | undefined {
  return FORMS[id];
}

/** True when every required field has a non-empty answer. */
export function isFormComplete(form: Form, data: Record<string, unknown>): boolean {
  return form.fields.every((f) => {
    if (!f.required) return true;
    const v = data[f.id];
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === "string" ? v.trim().length > 0 : v !== undefined && v !== null;
  });
}

/** Human-readable answer for admin views and the handoff pack. */
export function answerText(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}
