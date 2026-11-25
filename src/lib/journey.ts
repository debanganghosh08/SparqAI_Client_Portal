// The client journey: an ordered list of modules, each an ordered list of
// steps. Completion is a row in `progress` keyed by step id, and a module
// unlocks once every module before it is finished.
//
// This file is the one place to edit when you want a different engagement
// shape. Add, remove, or reorder modules and steps freely — nothing else in
// the app hardcodes a step id.

export type StepType = "doc" | "form" | "upload" | "action" | "checklist" | "board" | "handoff";

export type Step = {
  id: string;
  title: string;
  description: string;
  type: StepType;
  /** `doc` steps: key into DOCS. */
  doc?: string;
  /** `form` steps: key into FORMS. */
  form?: string;
  /** `upload` steps: which bucket the files land in, and what to ask for. */
  upload?: { category: string; asks: string[] };
  /** `action` steps: an external link, optionally from a setting. */
  action?: { label: string; settingKey?: string; url?: string; note?: string };
  /** `checklist` steps: the items to tick. */
  checklist?: string[];
};

export type Module = {
  slug: string;
  title: string;
  description: string;
  steps: Step[];
};

export const JOURNEY: Module[] = [
  {
    slug: "welcome",
    title: "Welcome",
    description: "How this portal works, what we need from you, and the agreement we both sign up to.",
    steps: [
      {
        id: "welcome-tour",
        title: "How this works",
        description: "Two minutes on how the portal is laid out and what happens in each phase.",
        type: "doc",
        doc: "how-it-works",
      },
      {
        id: "welcome-agreement",
        title: "Our working agreement",
        description: "Plain-English expectations on both sides: turnaround, revisions, and how we handle feedback.",
        type: "doc",
        doc: "working-agreement",
      },
    ],
  },
  {
    slug: "onboarding",
    title: "Onboarding",
    description: "Everything we need before the kickoff call. The more specific you are here, the less we have to guess later.",
    steps: [
      {
        id: "onboarding-business",
        title: "About your business",
        description: "Who you are, who you serve, and how you sell today.",
        type: "form",
        form: "business",
      },
      {
        id: "onboarding-project",
        title: "Goals and scope",
        description: "What success looks like, what is in scope, and what is deliberately out.",
        type: "form",
        form: "project",
      },
      {
        id: "onboarding-assets",
        title: "Brand and access",
        description: "Logos, fonts, and anything we need read access to. Upload what you have; missing pieces are fine.",
        type: "upload",
        upload: {
          category: "brand",
          asks: [
            "Logo files (SVG or PNG on a transparent background)",
            "Brand guidelines, if they exist",
            "Fonts or the names of the fonts you use",
            "Any existing copy, decks, or reference material",
          ],
        },
      },
    ],
  },
  {
    slug: "kickoff",
    title: "Kickoff",
    description: "One call to align on the plan, then a short prep list so the call is worth everyone's time.",
    steps: [
      {
        id: "kickoff-prep",
        title: "Prep for the call",
        description: "Five things to have ready. Tick them off as you go.",
        type: "checklist",
        checklist: [
          "Onboarding forms submitted",
          "Decision-maker confirmed and on the invite",
          "Two or three examples of work you admire",
          "Any hard deadlines written down",
          "Access requests approved",
        ],
      },
      {
        id: "kickoff-book",
        title: "Book the kickoff call",
        description: "Pick a slot that works for everyone who needs to be in the room.",
        type: "action",
        action: {
          label: "Open the booking calendar",
          settingKey: "kickoff_url",
          note: "Once the call is booked, mark this step complete so we know to prepare.",
        },
      },
    ],
  },
  {
    slug: "build",
    title: "The build",
    description: "Where the work shows up. Every deliverable lands here with a status you can see without asking.",
    steps: [
      {
        id: "build-board",
        title: "Track the work",
        description: "Your live deliverables board. Approve anything sitting in review.",
        type: "board",
      },
      {
        id: "build-feedback",
        title: "Consolidated feedback",
        description: "One round, one place. Specific beats polite — tell us what is wrong and why.",
        type: "form",
        form: "feedback",
      },
    ],
  },
  {
    slug: "handoff",
    title: "Launch and handoff",
    description: "The last mile: check the launch list, take the keys, and keep everything we built.",
    steps: [
      {
        id: "handoff-checklist",
        title: "Pre-launch checklist",
        description: "The things that quietly break launches. Confirm each one.",
        type: "checklist",
        checklist: [
          "Final assets approved in the deliverables board",
          "Analytics and tracking verified",
          "Domains, DNS, and SSL confirmed",
          "Owner accounts transferred to your team",
          "Backup and rollback plan written down",
        ],
      },
      {
        id: "handoff-pack",
        title: "Your handoff pack",
        description: "Every file, link, and credential from the engagement, in one place, yours to keep.",
        type: "handoff",
      },
    ],
  },
];

export const ALL_STEPS: Step[] = JOURNEY.flatMap((m) => m.steps);
export const ALL_STEP_IDS = new Set(ALL_STEPS.map((s) => s.id));

export function getModule(slug: string): Module | undefined {
  return JOURNEY.find((m) => m.slug === slug);
}

export function moduleOf(stepId: string): Module | undefined {
  return JOURNEY.find((m) => m.steps.some((s) => s.id === stepId));
}

export function isModuleComplete(mod: Module, completed: Set<string>): boolean {
  return mod.steps.length > 0 && mod.steps.every((s) => completed.has(s.id));
}

/** Sequential gating, with finished modules always reachable again. */
export function isModuleUnlocked(index: number, completed: Set<string>): boolean {
  const mod = JOURNEY[index];
  if (!mod) return false;
  if (isModuleComplete(mod, completed)) return true;
  return JOURNEY.slice(0, index).every((m) => isModuleComplete(m, completed));
}

export function blockingModuleTitle(index: number, completed: Set<string>): string | null {
  return JOURNEY.slice(0, index).find((m) => !isModuleComplete(m, completed))?.title ?? null;
}

export function journeyStats(completed: Set<string>, admin = false) {
  const done = ALL_STEPS.filter((s) => completed.has(s.id)).length;
  const nextIndex = JOURNEY.findIndex((m, i) => {
    const d = m.steps.filter((s) => completed.has(s.id)).length;
    return (admin || isModuleUnlocked(i, completed)) && d < m.steps.length;
  });
  return {
    total: ALL_STEPS.length,
    done,
    pct: ALL_STEPS.length ? Math.round((done / ALL_STEPS.length) * 100) : 0,
    complete: ALL_STEPS.length > 0 && done === ALL_STEPS.length,
    nextIndex,
    nextModule: nextIndex >= 0 ? JOURNEY[nextIndex] : null,
  };
}

/** Coarse phase label used in the admin list. */
export function phaseFor(completed: Set<string>): string {
  if (completed.size === 0) return "Invited";
  const stats = journeyStats(completed);
  if (stats.complete) return "Complete";
  return JOURNEY[stats.nextIndex >= 0 ? stats.nextIndex : 0].title;
}
