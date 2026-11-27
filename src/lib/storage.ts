// Uploads are written to data/uploads/<userId>/ and served back through an
// authenticated route, never from /public — a client can only ever read files
// attached to their own project.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { UPLOAD_DIR } from "./db";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
/** Total upload allowance per client. Raise it per account when a project
 *  genuinely needs more; the point is that no single login can fill the disk. */
export const MAX_USER_BYTES = 500 * 1024 * 1024;

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

/** Strip anything that could escape the uploads directory. */
export function safeName(name: string): string {
  return path.basename(name).replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file";
}

export async function saveUpload(userId: number, file: File): Promise<{ storedName: string; size: number }> {
  const dir = path.join(UPLOAD_DIR, String(userId));
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(safeName(file.name)).slice(0, 12);
  const storedName = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(dir, storedName), bytes);
  return { storedName, size: bytes.length };
}

export function uploadPath(userId: number, storedName: string): string {
  return path.join(UPLOAD_DIR, String(userId), path.basename(storedName));
}

export function deleteUpload(userId: number, storedName: string) {
  const p = uploadPath(userId, storedName);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

/** Everything a client ever uploaded. Used when their account is deleted, so
 *  the database cascade does not leave orphaned files on disk. */
export function deleteUserUploads(userId: number) {
  const dir = path.join(UPLOAD_DIR, String(userId));
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}
