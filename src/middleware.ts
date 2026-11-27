import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/sessionToken";
import { FRAME_ORIGINS } from "@/lib/embeds";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];

/** While a reset is pending these are the only API routes worth reaching: the
 *  two that finish the reset and the one that ends the session. */
const RESET_ALLOWED_API = ["/api/auth/set-password", "/api/auth/logout", "/api/account"];

/** The host this request was actually made to, honouring a proxy that rewrites
 *  it, so the origin comparison below does not fail behind a load balancer. */
function requestHost(req: NextRequest): string {
  return (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
}

/** The portal's own forms are the only thing allowed to change its data.
 *  SameSite=lax already stops most of this, but it is one cookie attribute
 *  standing alone; a browser that sends the cookie anyway, or a future change
 *  to `sameSite`, would leave every write route open to a page on another site
 *  posting as whoever is signed in. Browsers set one of these two headers on
 *  every state-changing request, so checking them costs nothing. */
function sameOriginWrite(req: NextRequest): boolean {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return true;

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "none") return true;
  if (fetchSite) return false;

  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host.toLowerCase() === requestHost(req);
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const dev = process.env.NODE_ENV !== "production";

  // Nonce-based CSP. Next.js reads the nonce out of this header and stamps it
  // onto its own inline scripts, so hydration keeps working without
  // 'unsafe-inline' for scripts. 'unsafe-inline' stays for styles because the
  // accent colour is injected as a <style> tag in the root layout.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Only the schedulers and form host in lib/embeds.ts. Everything else
    // stays unframeable, whatever an admin pastes into Settings.
    `frame-src ${FRAME_ORIGINS.join(" ")}`,
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  // The page policy must not reach /api. The file download route serves bytes
  // somebody else uploaded and sets a far stricter policy of its own
  // (`default-src 'none'` and `sandbox`); a header set here would replace it,
  // because middleware headers win, and quietly restore `script-src 'self'`
  // on exactly the responses that need it least.
  const isApi = pathname.startsWith("/api/");

  /** Every page response leaves through here so the CSP is never forgotten. */
  const withHeaders = (res: NextResponse) => {
    if (!isApi) res.headers.set("Content-Security-Policy", csp);
    return res;
  };
  const next = () => withHeaders(NextResponse.next({ request: { headers: requestHeaders } }));

  if (!sameOriginWrite(req)) {
    return withHeaders(NextResponse.json({ error: "Cross-site requests are not accepted." }, { status: 403 }));
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || pathname.startsWith("/_next") || pathname.startsWith("/brand/")) {
    return next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) return withHeaders(NextResponse.json({ error: "Not authenticated." }, { status: 401 }));
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return withHeaders(NextResponse.redirect(url));
  }

  // A client created by an admin logs in with a one-time password and has to
  // choose a real one before anything else in the portal opens. The API gate
  // matters as much as the page one: without it the portal's own data routes
  // answered a session that had never set a password. The authoritative check
  // reads must_reset from the database in requireSession(); this is the cheap
  // first pass, since middleware cannot reach SQLite.
  if (session.mustReset) {
    if (pathname.startsWith("/api/")) {
      if (!RESET_ALLOWED_API.some((p) => pathname === p)) {
        return withHeaders(NextResponse.json({ error: "Set your password first." }, { status: 403 }));
      }
    } else if (!pathname.startsWith("/set-password")) {
      return withHeaders(NextResponse.redirect(new URL("/set-password", req.url)));
    }
  }

  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return withHeaders(NextResponse.redirect(new URL("/", req.url)));
  }

  return next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:png|jpg|jpeg|svg|gif|webp|ico|txt|xml)$).*)"],
};
