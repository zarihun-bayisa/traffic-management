import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

const agreementStatuses = ["ACTIVE", "UPCOMING", "COMPLETED", "CANCELLED"];

type AgreementRow = RowDataPacket & {
  id: number;
  vehicle_id: number;
  driver_id: number;
  start_date: string;
  end_date: string | null;
};

export async function PATCH(request: Request, context: RouteContext<"/api/agreements/[id]">) {
  const { id: rawId } = await context.params;
  const agreementId = Number(rawId);
  if (!Number.isSafeInteger(agreementId) || agreementId <= 0) {
    return NextResponse.json({ message: "Invalid agreement ID." }, { status: 400 });
  }

  let connection;
  try {
    const body = await request.json();
    const status = body.status;
    if (typeof status !== "string" || !agreementStatuses.includes(status)) {
      return NextResponse.json({ message: "Choose a valid agreement status." }, { status: 400 });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute<AgreementRow[]>(
      "SELECT id, vehicle_id, driver_id, start_date, end_date FROM vehicle_driver_agreements WHERE id = ? FOR UPDATE",
      [agreementId]
    );
    const agreement = rows[0];
    if (!agreement) {
      await connection.rollback();
      return NextResponse.json({ message: "Agreement not found." }, { status: 404 });
    }

    if (status === "ACTIVE" || status === "UPCOMING") {
      const [conflicts] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM vehicle_driver_agreements
         WHERE id <> ? AND status IN ('ACTIVE', 'UPCOMING')
           AND (vehicle_id = ? OR driver_id = ?)
           AND (end_date IS NULL OR end_date >= ?)
           AND (? IS NULL OR start_date <= ?)
         LIMIT 1 FOR UPDATE`,
        [agreementId, agreement.vehicle_id, agreement.driver_id, agreement.start_date, agreement.end_date, agreement.end_date]
      );
      if (conflicts.length) {
        await connection.rollback();
        return NextResponse.json({ message: "This vehicle or driver already has an overlapping active agreement." }, { status: 409 });
      }
    }

    await connection.execute(
      "UPDATE vehicle_driver_agreements SET status = ? WHERE id = ?",
      [status, agreementId]
    );
    await connection.commit();
    return NextResponse.json({ message: "Agreement status updated." });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Update agreement error:", error);
    return NextResponse.json({ message: "Could not update agreement." }, { status: 500 });
  } finally {
    connection?.release();
  }
}