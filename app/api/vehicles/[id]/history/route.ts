import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_request: Request, context: RouteContext<"/api/vehicles/[id]/history">) {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ message: "Invalid vehicle id" }, { status: 400 });
  }

  try {
    const [rows] = await db.execute(
      `SELECT id, action, details, created_at
       FROM vehicle_history WHERE vehicle_id = ? ORDER BY id DESC`,
      [id]
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Fetch vehicle history error:", error);
    return NextResponse.json({ message: "Could not fetch vehicle history" }, { status: 500 });
  }
}