import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authCookieName, authSessionMaxAge, createAuthSession } from "@/lib/auth-session";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function POST(request: NextRequest) {
  const configuredUsername = process.env.ADMIN_USERNAME;
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!configuredUsername || !configuredPassword || !secret || secret.length < 32) {
    return NextResponse.json(
      { message: "Admin login is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD, and a 32-character AUTH_SECRET in .env.local." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Enter your username and password." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("username" in body) || !("password" in body)) {
    return NextResponse.json({ message: "Enter your username and password." }, { status: 400 });
  }
  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string" ||
      !safeEqual(username.trim(), configuredUsername) || !safeEqual(password, configuredPassword)) {
    return NextResponse.json({ message: "The username or password is incorrect." }, { status: 401 });
  }

  const response = NextResponse.json({ message: "Signed in." });
  response.cookies.set(authCookieName, createAuthSession(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: authSessionMaxAge,
  });
  return response;
}