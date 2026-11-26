import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getProviders } from "@/lib/integrations";
import PortalShell from "@/components/PortalShell";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const settings = getSettings();
  const providers = getProviders();
  return <PortalShell name={session.name || session.email} role={session.role} view={session.role === "admin" ? "admin" : "client"} portalName={settings.portal_name}>
    <div className="max-w-5xl mx-auto fade-up">
      <p className="eyebrow mb-2">Data connections</p><h1 className="text-3xl font-bold title-grad">Integrations</h1>
      <p className="text-sm text-[var(--muted)] mt-2 max-w-2xl">Connect campaign and project tools to bring activity into this portal. Provider credentials stay on the server and are never shown to clients.</p>
      <div className="card p-4 mt-6 mb-5 flex gap-3"><span className="text-[var(--accent)]">ⓘ</span><p className="text-xs leading-relaxed text-[var(--muted)]">EmailBison and GoHighLevel support an admin-triggered, read-only metrics pull. Client-specific synchronization is not configured yet, so shared account totals are hidden from client logins.</p></div>
      <div className="grid md:grid-cols-2 gap-4">
        {providers.map((provider) => <article key={provider.id} className="card p-5 lg:p-6 flex flex-col">
          <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><div className="w-11 h-11 card-flat rounded-xl flex items-center justify-center text-sm font-bold">{provider.name === "Microsoft Outlook" ? "O" : provider.name.slice(0, 2).toUpperCase()}</div><div><h2 className="font-semibold">{provider.name}</h2><p className="text-[11px] text-[var(--muted)] mt-1">{provider.kind}</p></div></div><span className={session.role === "admin" && provider.readiness ? "chip chip-next" : "chip chip-todo"}>{session.role === "admin" ? (provider.readiness ? "Configured" : "Not configured") : "Agency managed"}</span></div>
          <p className="text-sm text-[var(--muted)] leading-relaxed mt-5">{provider.description}</p>
          {session.role === "admin" && <div className="mt-5 pt-4 hairline"><p className="eyebrow mb-3">Setup checklist</p><ul className="space-y-2">{provider.requirements.map((item) => <li key={item} className="text-xs text-[var(--muted)] flex gap-2"><span className="text-[var(--faint)]">•</span>{item}</li>)}</ul></div>}
          {session.role === "admin" && <a href={provider.setupUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm mt-5 self-start">Open provider setup ↗</a>}
          <p className="mono mt-auto pt-5">{session.role === "admin" ? (provider.readiness ? "Server credentials detected · test from admin dashboard" : "Waiting for secure server configuration") : "Connections are managed by Spark Labs"}</p>
        </article>)}
      </div>
      <div className="card p-5 mt-5"><p className="eyebrow mb-2">Next step for engineering</p><p className="text-sm text-[var(--muted)] leading-relaxed">Implement one provider at a time: OAuth/API authorization, encrypted credential storage scoped to each client, read-only sync, pagination and backfill, then reconcile each source’s counts against its own UI before publishing KPIs.</p></div>
    </div>
  </PortalShell>;
}
