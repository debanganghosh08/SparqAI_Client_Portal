import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { get, type FileRow } from "@/lib/db";
import { headerFilename, isInlineSafeType, readUpload } from "@/lib/storage";

/** Uploads never sit in /public: every download is checked against the session. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const row = await get<FileRow>("SELECT * FROM files WHERE id = ?", [Number(id)]);
  if (!row) return NextResponse.json({ error: "File not found." }, { status: 404 });
  if (session.role !== "admin" && row.user_id !== session.userId) {
    return NextResponse.json({ error: "Not your file." }, { status: 403 });
  }

  const bytes = await readUpload(row.user_id, row.stored_name);
  if (!bytes) return NextResponse.json({ error: "File is no longer stored." }, { status: 410 });

  // The stored mime came from whoever uploaded the file, so it decides nothing
  // on its own. Only a short list of types renders in the tab; anything else
  // downloads, which stops an uploaded page or SVG from running as the viewer
  // on this origin — an admin opening a client's file is the case that matters.
  const url = new URL(req.url);
  const inlineRequested = url.searchParams.get("download") !== "1";
  const inline = inlineRequested && isInlineSafeType(row.mime);
  const contentType = inline ? row.mime : "application/octet-stream";
  // `sandbox` is the strongest option but browsers' built-in PDF viewers will
  // not render under it, and previewing a PDF is most of the point of this
  // route. A PDF is safe without it: nosniff plus an exact application/pdf
  // type means it can never be reinterpreted as a document on this origin.
  const isPdf = contentType === "application/pdf";
  const csp = isPdf
    ? "default-src 'none'; object-src 'none'; frame-ancestors 'none'"
    : "default-src 'none'; img-src 'self'; object-src 'none'; sandbox";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${headerFilename(row.file_name)}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": csp,
    },
  });
}
