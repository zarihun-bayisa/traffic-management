import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

type PenaltyPaymentRow = RowDataPacket & {
  id: number;
  status: string;
  payment_status: string;
};

export async function PATCH(_request: Request, context: RouteContext<"/api/payments/[id]">) {
  const { id: rawId } = await context.params;
  const paymentId = Number(rawId);
  if (!Number.isSafeInteger(paymentId) || paymentId <= 0) {
    return NextResponse.json({ message: "Invalid payment ID." }, { status: 400 });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute<PenaltyPaymentRow[]>(
      "SELECT id, status, payment_status FROM penalties WHERE id = ? FOR UPDATE",
      [paymentId]
    );
    const penalty = rows[0];
    if (!penalty) {
      await connection.rollback();
      return NextResponse.json({ message: "Penalty not found." }, { status: 404 });
    }
    if (penalty.status !== "ISSUED") {
      await connection.rollback();
      return NextResponse.json({ message: "Only issued penalties can be marked paid." }, { status: 409 });
    }
    if (penalty.payment_status === "PAID") {
      await connection.rollback();
      return NextResponse.json({ message: "This penalty is already marked paid." }, { status: 409 });
    }

    await connection.execute<ResultSetHeader>(
      "UPDATE penalties SET payment_status = 'PAID', paid_at = CURRENT_TIMESTAMP WHERE id = ?",
      [paymentId]
    );
    await connection.commit();
    return NextResponse.json({ message: "Payment marked as paid." });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Update penalty payment error:", error);
    return NextResponse.json({ message: "Could not update payment status." }, { status: 500 });
  } finally {
    connection?.release();
  }
}