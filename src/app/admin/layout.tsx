import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { BRAND } from "@/lib/brand";

export async function generateMetadata(): Promise<Metadata> {
  const settings = getSettings();
  return { title: `${settings.portal_name || BRAND.name} · Admin Portal` };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
