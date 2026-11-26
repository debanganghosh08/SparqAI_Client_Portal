const weeks = [
  { week: "Oct 06", leads: 82, previous: 64, sent: 4200 },
  { week: "Oct 13", leads: 96, previous: 71, sent: 4680 },
  { week: "Oct 20", leads: 91, previous: 78, sent: 4510 },
  { week: "Oct 27", leads: 118, previous: 86, sent: 5120 },
  { week: "Nov 03", leads: 132, previous: 94, sent: 5480 },
  { week: "Nov 10", leads: 124, previous: 103, sent: 5310 },
  { week: "Nov 17", leads: 158, previous: 112, sent: 5940 },
  { week: "Nov 24", leads: 176, previous: 128, sent: 6220 },
];

const campaigns = [
  { name: "Leadership teams · UK", channel: "EmailBison", leads: 684, sent: "18,240", replies: 92, status: "Active" },
  { name: "Revenue operations · US", channel: "EmailBison", leads: 512, sent: "14,880", replies: 71, status: "Active" },
  { name: "Founder outreach · Canada", channel: "Outlook", leads: 238, sent: "5,460", replies: 34, status: "Review" },
];

const kpis = [
  { label: "Campaigns", value: "08", delta: "+2 this month", icon: "↗" },
  { label: "Leads sourced", value: "4,286", delta: "+18.4% vs prior period", icon: "◎" },
  { label: "Emails sent", value: "38,580", delta: "+12.8% vs prior period", icon: "✉" },
  { label: "Replies", value: "612", delta: "1.6% reply rate", icon: "↩" },
];

function TrendChart() {
  const max = 190;
  const points = weeks.map((item, index) => `${30 + index * 77},${150 - (item.leads / max) * 125}`).join(" ");
  const previous = weeks.map((item, index) => `${30 + index * 77},${150 - (item.previous / max) * 125}`).join(" ");
  const fill = `30,150 ${points} 569,150`;
  return (
    <div className="card p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div><p className="eyebrow mb-2">Lead generation</p><h2 className="text-lg font-semibold">Weekly progress</h2><p className="text-xs text-[var(--muted)] mt-1">New leads added · last 8 weeks</p></div>
        <div className="flex items-center gap-4 text-xs text-[var(--muted)]"><span className="flex items-center gap-2"><i className="w-2 h-2 rounded-full bg-[var(--accent)]" />This period</span><span className="flex items-center gap-2"><i className="w-2 h-2 rounded-full bg-[#595751]" />Previous period</span></div>
      </div>
      <div className="w-full overflow-hidden">
        <svg viewBox="0 0 600 190" role="img" aria-label="Weekly leads chart comparing this and the previous period" className="w-full h-[190px] overflow-visible">
          {[25, 65, 105, 150].map((y, i) => <g key={y}><line x1="30" y1={y} x2="570" y2={y} stroke="#292927" strokeDasharray="3 5" /><text x="2" y={y + 4} fill="#74736d" fontSize="10">{[180, 120, 60, 0][i]}</text></g>)}
          <polyline points={previous} fill="none" stroke="#595751" strokeWidth="2" strokeDasharray="5 5" strokeLinejoin="round" strokeLinecap="round" />
          <polygon points={fill} fill="url(#leadFill)" />
          <defs><linearGradient id="leadFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#d8cfc0" stopOpacity=".22" /><stop offset="1" stopColor="#d8cfc0" stopOpacity="0" /></linearGradient></defs>
          <polyline points={points} fill="none" stroke="#d8cfc0" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {weeks.map((item, index) => { const x = 30 + index * 77; const y = 150 - (item.leads / max) * 125; return <g key={item.week}><circle cx={x} cy={y} r="4" fill="#d8cfc0" stroke="#121211" strokeWidth="2" /><text x={x} y="178" fill="#85837d" fontSize="9" textAnchor="middle">{item.week}</text></g>; })}
        </svg>
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs"><span className="text-emerald-300">↑ 37.5%</span><span className="text-[var(--muted)]">lead volume compared with the first week shown</span></div>
    </div>
  );
}

function WeeklyBars() {
  const max = Math.max(...weeks.map((item) => item.sent));
  return <div className="card p-5 lg:p-6 h-full">
    <div className="mb-6"><p className="eyebrow mb-2">Outbound activity</p><h2 className="text-lg font-semibold">Emails sent each week</h2><p className="text-xs text-[var(--muted)] mt-1">Volume by send week</p></div>
    <div className="flex items-end gap-2 h-[145px]">
      {weeks.map((item, i) => <div key={item.week} className="flex-1 h-full flex flex-col justify-end items-center gap-2 group" title={`${item.week}: ${item.sent.toLocaleString()} emails`}>
        <span className="text-[9px] text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity">{(item.sent / 1000).toFixed(1)}k</span>
        <div className="w-full rounded-t-[5px] transition-all group-hover:brightness-125" style={{ height: `${Math.max(8, (item.sent / max) * 105)}px`, background: i === weeks.length - 1 ? "var(--accent)" : "linear-gradient(180deg,#77746d,#42413c)" }} />
        <span className="text-[8px] text-[var(--faint)]">{item.week.slice(4)}</span>
      </div>)}
    </div>
    <div className="flex justify-between border-t border-[var(--border)] mt-4 pt-4"><div><p className="eyebrow mb-1">Weekly average</p><p className="font-semibold num">5,243 <span className="text-xs text-emerald-300">↑ 14%</span></p></div><div className="text-right"><p className="eyebrow mb-1">Latest week</p><p className="font-semibold num">6,220</p></div></div>
  </div>;
}

export default function CampaignAnalytics() {
  return <section className="space-y-4 mb-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow mb-2">Spark Labs · Client portal</p><h1 className="text-3xl font-bold">Campaign overview</h1><p className="text-sm text-[var(--muted)] mt-2">A snapshot of your outreach performance.</p></div><span className="chip chip-next">DEMO DATA · NOT LIVE</span></div>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 stagger">{kpis.map((item) => <div key={item.label} className="card-flat px-4 py-4"><div className="flex justify-between items-center"><p className="eyebrow">{item.label}</p><span className="text-[var(--muted)]">{item.icon}</span></div><p className="text-2xl font-bold num mt-3">{item.value}</p><p className="text-[11px] text-[var(--muted)] mt-2">{item.delta}</p></div>)}</div>
    <div className="grid xl:grid-cols-[1.55fr_1fr] gap-4"><TrendChart /><WeeklyBars /></div>
    <div className="card overflow-hidden">
      <div className="p-5 flex items-end justify-between gap-4"><div><p className="eyebrow mb-2">Campaigns</p><h2 className="text-lg font-semibold">Recent activity</h2></div><span className="text-xs text-[var(--muted)]">3 example campaigns</span></div>
      <div className="overflow-x-auto"><table className="tbl min-w-[650px]"><thead><tr><th>Campaign</th><th>Channel</th><th>Leads</th><th>Emails sent</th><th>Replies</th><th>Status</th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.name}><td className="font-medium">{campaign.name}</td><td>{campaign.channel}</td><td className="num">{campaign.leads}</td><td className="num">{campaign.sent}</td><td className="num">{campaign.replies}</td><td><span className={campaign.status === "Active" ? "chip chip-done" : "chip chip-todo"}>{campaign.status}</span></td></tr>)}</tbody></table></div>
    </div>
    <p className="text-[11px] leading-relaxed text-[var(--faint)]">These sample figures illustrate the dashboard only. Live campaign data appears after the provider connectors and client-specific data sync are configured.</p>
  </section>;
}
