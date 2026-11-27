import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { all, get, logActivity, run, type FileRow, type User } from "@/lib/db";
import { completeStep } from "@/lib/clients";
import { ALL_STEPS } from "@/lib/journey";
import { hit, tooMany } from "@/lib/rateLimit";
import { deleteUpload, isAllowedType, MAX_UPLOAD_BYTES, MAX_USER_BYTES, safeName, saveUpload } from "@/lib/storage";

/** Multipart framing adds a little to the body around the file itself. */
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024;

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const limit = await hit("upload", session.userId);
  if (!limit.allowed) return tooMany(limit);

  // Checked before req.formData(), which buffers the whole body into memory:
  // without this, the 25 MB rule below is enforced only after we have already
  // held a much larger upload.
  const declaredLength = req.headers.get("content-length");
  if (declaredLength === null) {
    // No length means a chunked body, which this check cannot bound. Browsers
    // always send one for a FormData upload, so refusing costs nothing real.
    return NextResponse.json({ error: "Upload length is required." }, { status: 411 });
  }
  if (Number(declaredLength) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Files are limited to 25 MB." }, { status: 413 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const category = String(form.get("category") ?? "general").slice(0, 40);
  const label = String(form.get("label") ?? "").slice(0, 160);
  const forUser = form.get("userId");

  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Files are limited to 25 MB." }, { status: 400 });
  if (!isAllowedType(file.type)) return NextResponse.json({ error: `Files of type ${file.type || "unknown"} are not accepted.` }, { status: 400 });

  // An admin may file something on a client's behalf, but only onto a client
  // who exists — otherwise a typed id would create a directory belonging to
  // nobody and a row no page would ever show.
  let ownerId = session.userId;
  if (session.role === "admin" && forUser) {
    const owner = await get<User>("SELECT id FROM users WHERE id = ? AND role = 'client' AND status = 'active'", [Number(forUser)]);
    if (!owner) return NextResponse.json({ error: "That client does not exist." }, { status: 404 });
    ownerId = owner.id;
  }

  // A per-client ceiling on disk. Twenty-five MB a file with nothing above it
  // means one account can fill the volume and take the portal down with it.
  const used = (await get<{ n: number }>("SELECT COALESCE(SUM(size), 0) AS n FROM files WHERE user_id = ?", [ownerId]))?.n ?? 0;
  if (used + file.size > MAX_USER_BYTES) {
    return NextResponse.json({ error: "This project has reached its storage limit. Delete a file or ask us to raise it." }, { status: 413 });
  }

  const { storedName, size } = await saveUpload(ownerId, file);

  await run(
    `INSERT INTO await files(user_id, uploaded_by, uploader_role, label, category, file_name, stored_name, mime, size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ownerId, session.userId, session.role, label, category, safeName(file.name), storedName, file.type || "application/octet-stream", size]
  );

  // An upload step counts as done the moment the first file lands in its bucket.
  const step = ALL_STEPS.find((s) => s.upload?.category === category);
  if (step) await completeStep(ownerId, step.id);

  await logActivity({
    userId: ownerId,
    actorName: session.name || session.email,
    actorRole: session.role,
    kind: "file_upload",
    summary: `Uploaded ${safeName(file.name)}`,
  });

  return NextResponse.json({ ok: true, files: await all<FileRow>("SELECT * FROM files WHERE user_id = ? AND category = ? ORDER BY created_at DESC", [ownerId, category]) });
}

export async function DELETE(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const deleteLimit = await hit("write", session.userId);
  if (!deleteLimit.allowed) return tooMany(deleteLimit);

  const { id } = await req.json().catch(() => ({}));
  const row = await get<FileRow>("SELECT * FROM files WHERE id = ?", [Number(id)]);
  if (!row) return NextResponse.json({ error: "File not found." }, { status: 404 });
  if (session.role !== "admin" && row.user_id !== session.userId) {
    return NextResponse.json({ error: "Not your file." }, { status: 403 });
  }

  await deleteUpload(row.user_id, row.stored_name);
  await run("DELETE FROM files WHERE id = ?", [row.id]);
  await logActivity({ userId: row.user_id, actorName: session.name || session.email, actorRole: session.role, kind: "file_delete", summary: `Deleted ${row.file_name}` });

  return NextResponse.json({ ok: true });
}
