import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

type PenaltyRow = RowDataPacket & {
  id: number;
  event_id: number;
  status: string;
};

export async function PATCH(request: Request, context: RouteContext<"/api/penalties/[id]">) {
  const { id: rawId } = await context.params;
  const penaltyId = Number(rawId);
  if (!Number.isSafeInteger(penaltyId) || penaltyId <= 0) {
    return NextResponse.json({ message: "Invalid penalty ID." }, { status: 400 });
  }

  let connection;
  try {
    const body = await request.json();
    const decision = body.decision;
    if (decision !== "ISSUED" && decision !== "REJECTED") {
      return NextResponse.json({ message: "Choose Issue or Reject." }, { status: 400 });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute<PenaltyRow[]>(
      "SELECT id, event_id, status FROM penalties WHERE id = ? FOR UPDATE",
      [penaltyId]
    );
    const penalty = rows[0];
    if (!penalty) {
      await connection.rollback();
      return NextResponse.json({ message: "Penalty assessment not found." }, { status: 404 });
    }
    if (penalty.status !== "PENDING_REVIEW") {
      await connection.rollback();
      return NextResponse.json({ message: "This assessment has already been reviewed." }, { status: 409 });
    }

    await connection.execute(
      "UPDATE penalties SET status = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [decision, penaltyId]
    );
    await connection.execute(
      "UPDATE traffic_events SET review_status = ? WHERE id = ?",
      [decision === "ISSUED" ? "VIOLATION_ISSUED" : "REVIEWED", penalty.event_id]
    );
    await connection.commit();
    return NextResponse.json({ message: decision === "ISSUED" ? "Penalty issued." : "Assessment rejected." });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Review penalty error:", error);
    return NextResponse.json({ message: "Could not review penalty." }, { status: 500 });
  } finally {
    connection?.release();
  }
}