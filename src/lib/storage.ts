// Uploads live in a private Supabase Storage bucket under <userId>/<name> and
// are served back through an authenticated route, never by a public URL — a
// client can only ever read files attached to their own project.
//
// They were files on local disk until 27 Nov 2026. Vercel's filesystem is
// read-only and per-instance, so an upload written there would have vanished
// with the instance that accepted it.
import path from "path";
import crypto from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "portal-uploads";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
/** Total upload allowance per client. Raise it per account when a project
 *  genuinely needs more; the point is that no single login can fill the disk. */
export const MAX_USER_BYTES = 500 * 1024 * 1024;

/** The service-role key bypasses row-level security, which is correct here:
 *  the portal does its own authorisation in front of every one of these calls,
 *  and it has to be able to read any client's file on an admin's behalf. It is
 *  server-only and must never be given a NEXT_PUBLIC_ prefix. */
let cached: SupabaseClient | null = null;
function storage(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  // Supabase is replacing the legacy `service_role` JWT with a secret key
  // (`sb_secret_...`); both authenticate the same way and both are accepted
  // here, so a project created under either scheme works without a rename.
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required for uploads. Supabase: Settings -> API Keys.",
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

const ALLOWED = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/avif",
  "application/pdf", "application/zip", "application/x-zip-compressed",
  "text/plain", "text/csv", "text/markdown",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "font/otf", "font/ttf", "font/woff", "font/woff2", "application/octet-stream",
]);

/** Types a browser will execute as a document on our own origin. An upload that
 *  the portal later serves inline would run as the viewer — including an admin
 *  opening a client's file — so these never get in. */
const EXECUTABLE = new Set([
  "text/html", "application/xhtml+xml", "application/xml", "text/xml",
  "application/javascript", "text/javascript", "module", "text/ecmascript",
  "application/ecmascript", "application/x-httpd-php", "text/x-php",
]);

/** Served inline; everything else downloads. SVG is deliberately absent: it is
 *  an image to a person and a script host to a browser. */
const INLINE_SAFE = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif",
  "application/pdf", "text/plain", "text/csv", "text/markdown",
]);

export function isExecutableType(mime: string): boolean {
  const base = mime.split(";")[0].trim().toLowerCase();
  return EXECUTABLE.has(base) || (base.endsWith("+xml") && base !== "image/svg+xml");
}

export function isAllowedType(mime: string): boolean {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (isExecutableType(base)) return false;
  return ALLOWED.has(base) || base.startsWith("image/") || base.startsWith("text/");
}

/** True only for types that are safe to render in the browser tab. */
export function isInlineSafeType(mime: string): boolean {
  return INLINE_SAFE.has(mime.split(";")[0].trim().toLowerCase());
}

/** A filename safe to put inside a Content-Disposition header. */
export function headerFilename(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file";
}

/** Strip anything that could escape the client's own folder. */
export function safeName(name: string): string {
  return path.basename(name).replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file";
}

/** The object key for a stored file. basename() is applied again here so a
 *  stored_name tampered with in the database still cannot reach another
 *  client's folder. */
function objectKey(userId: number, storedName: string): string {
  return `${userId}/${path.basename(storedName)}`;
}

export async function saveUpload(userId: number, file: File): Promise<{ storedName: string; size: number }> {
  const ext = path.extname(safeName(file.name)).slice(0, 12);
  const storedName = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await storage()
    .storage.from(BUCKET)
    .upload(objectKey(userId, storedName), bytes, {
      // The portal decides what it serves back and with which headers; letting
      // the store infer a type from the name would hand that decision to the
      // uploader.
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { storedName, size: bytes.length };
}

/** The bytes of one stored file, for the authenticated download route.
 *  Returns null when the object is missing, which a deleted-then-requested
 *  file looks like. */
export async function readUpload(userId: number, storedName: string): Promise<Buffer | null> {
  const { data, error } = await storage().storage.from(BUCKET).download(objectKey(userId, storedName));
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteUpload(userId: number, storedName: string) {
  await storage().storage.from(BUCKET).remove([objectKey(userId, storedName)]);
}

/** Everything a client ever uploaded. Used when their account is deleted, so
 *  the database cascade does not leave orphaned objects in the bucket. */
export async function deleteUserUploads(userId: number) {
  const client = storage();
  const { data, error } = await client.storage.from(BUCKET).list(String(userId), { limit: 1000 });
  if (error || !data || data.length === 0) return;
  await client.storage.from(BUCKET).remove(data.map((entry) => `${userId}/${entry.name}`));
}
