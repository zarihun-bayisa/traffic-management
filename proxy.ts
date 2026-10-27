import { NextResponse, type NextRequest } from "next/server";
import { authCookieName, isValidAuthSession } from "./lib/auth-session";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(authCookieName)?.value;
  const secret = process.env.AUTH_SECRET;
  if (token && secret && isValidAuthSession(token, secret)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/auth/login|api/auth/logout).*)"],
};