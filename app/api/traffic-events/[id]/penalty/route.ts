import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

type TrafficEventRow = RowDataPacket & {
  id: number;
  vehicle_id: number | null;
  plate_number: string | null;
  review_status: string;
};

type ViolationTypeRow = RowDataPacket & {
  id: number;
  name: string;
  amount: string;
  currency: string;
};

export async function POST(request: Request, context: RouteContext<"/api/traffic-events/[id]/penalty">) {
  const { id: rawId } = await context.params;
  const eventId = Number(rawId);
  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ message: "Invalid traffic event ID." }, { status: 400 });
  }

  let connection;
  try {
    const body = await request.json();
    const violationTypeId = Number(body.violation_type_id);
    if (!Number.isSafeInteger(violationTypeId) || violationTypeId <= 0) {
      return NextResponse.json({ message: "Choose a valid violation type." }, { status: 400 });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    const [events] = await connection.execute<TrafficEventRow[]>(
      "SELECT id, vehicle_id, plate_number, review_status FROM traffic_events WHERE id = ? FOR UPDATE",
      [eventId]
    );
    const event = events[0];
    if (!event) {
      await connection.rollback();
      return NextResponse.json({ message: "Traffic event not found." }, { status: 404 });
    }
    if (!event.vehicle_id || !event.plate_number) {
      await connection.rollback();
      return NextResponse.json({ message: "This event has no registered vehicle to assess." }, { status: 400 });
    }
    if (event.review_status !== "PENDING") {
      await connection.rollback();
      return NextResponse.json({ message: "This traffic event has already been reviewed." }, { status: 409 });
    }

    const [types] = await connection.execute<ViolationTypeRow[]>(
      "SELECT id, name, amount, currency FROM violation_types WHERE id = ? AND active = 1",
      [violationTypeId]
    );
    const violationType = types[0];
    if (!violationType) {
      await connection.rollback();
      return NextResponse.json({ message: "Violation type not found or inactive." }, { status: 404 });
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO penalties
       (event_id, vehicle_id, violation_type_id, plate_number, violation_name, amount, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [eventId, event.vehicle_id, violationType.id, event.plate_number, violationType.name, violationType.amount, violationType.currency]
    );
    await connection.execute(
      "UPDATE traffic_events SET review_status = 'PENALTY_PENDING' WHERE id = ?",
      [eventId]
    );
    await connection.commit();

    return NextResponse.json({
      id: result.insertId,
      message: "Penalty assessment created and sent for review.",
      status: "PENDING_REVIEW",
    }, { status: 201 });
  } catch (error) {
    if (connection) await connection.rollback();
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "A penalty assessment already exists for this event." }, { status: 409 });
    }
    console.error("Create penalty assessment error:", error);
    return NextResponse.json({ message: "Could not create penalty assessment." }, { status: 500 });
  } finally {
    connection?.release();
  }
}