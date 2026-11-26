export type Provider = {
  id: string;
  name: string;
  kind: string;
  description: string;
  readiness: boolean;
  requirements: string[];
  setupUrl: string;
};

export function getProviders(): Provider[] {
  const env = process.env;
  return [
    {
      id: "emailbison", name: "EmailBison", kind: "Outbound campaigns",
      description: "Campaign, send, lead and reply reporting from EmailBison.",
      readiness: Boolean(env.EMAILBISON_API_URL && env.EMAILBISON_API_KEY),
      requirements: ["Workspace API URL", "Server-side API key", "Client workspace mapping"],
      setupUrl: "https://app.emailbison.com/",
    },
    {
      id: "slack", name: "Slack", kind: "Team updates",
      description: "Project milestones, decisions and client-approved activity updates.",
      readiness: Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET && env.SLACK_SIGNING_SECRET),
      requirements: ["Slack app client ID and secret", "Signing secret", "OAuth callback and approved scopes"],
      setupUrl: "https://api.slack.com/apps",
    },
    {
      id: "outlook", name: "Microsoft Outlook", kind: "Email activity",
      description: "Mailbox and send activity through Microsoft Graph with client consent.",
      readiness: Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET && env.MICROSOFT_TENANT_ID),
      requirements: ["Microsoft Entra app registration", "Client ID and secret", "Tenant ID, redirect URI and consented Graph scopes"],
      setupUrl: "https://entra.microsoft.com/",
    },
  ];
}
