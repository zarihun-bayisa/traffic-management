import { NextResponse } from "next/server";
import { authCookieName } from "@/lib/auth-session";

export async function POST() {
  const response = NextResponse.json({ message: "Signed out." });
  response.cookies.set(authCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}