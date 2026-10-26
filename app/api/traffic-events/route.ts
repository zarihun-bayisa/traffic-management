
import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";

type VehicleRow = RowDataPacket & {
  id: number;
  plate_number: string;
};

type EventRow = RowDataPacket & {
  id: number;
  camera_id: number | null;
  plate_number: string | null;
  vehicle_id: number | null;
  event_type: string;
  description: string | null;
  confidence: number | null;
  review_status: string;
  detected_at: Date;
  vehicle_make: string | null;
  vehicle_model: string | null;
  owner_name: string | null;
};

const normalizePlate = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function GET() {
  try {
    const [rows] = await db.query<EventRow[]>(`
      SELECT
        e.id,
        e.camera_id,
        e.plate_number,
        e.vehicle_id,
        e.event_type,
        e.description,
        e.confidence,
        e.review_status,
        e.detected_at,
        v.make AS vehicle_make,
        v.model AS vehicle_model,
        v.owner_name
      FROM traffic_events e
      LEFT JOIN vehicles v ON v.id = e.vehicle_id
      ORDER BY e.detected_at DESC
      LIMIT 100
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET traffic events error:", error);
    return NextResponse.json(
      { message: "Failed to load traffic events." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (typeof body.plate_number !== "string") {
      return NextResponse.json(
        { message: "A recognized plate number is required." },
        { status: 400 }
      );
    }

    const plate = normalizePlate(body.plate_number);

    if (plate.length < 4 || plate.length > 20) {
      return NextResponse.json(
        { message: "The plate number is invalid." },
        { status: 400 }
      );
    }

    const confidence = Number(body.confidence ?? 0);

    if (
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1
    ) {
      return NextResponse.json(
        { message: "Confidence must be between 0 and 1." },
        { status: 400 }
      );
    }

    const [vehicles] = await db.execute<VehicleRow[]>(
      `SELECT id, plate_number
       FROM vehicles
       WHERE UPPER(REPLACE(REPLACE(plate_number, '-', ''), ' ', '')) = ?
       LIMIT 1`,
      [plate]
    );

    const vehicle = vehicles[0];
    const eventType = vehicle
      ? "PLATE_DETECTED"
      : "UNREGISTERED_VEHICLE";

    const description = vehicle
      ? "Plate recognized; matching vehicle record found. Review if needed."
      : "No matching vehicle record found. Verify the plate and registration.";

    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO traffic_events
        (plate_number, vehicle_id, event_type, description,
         confidence, review_status)
       VALUES (?, ?, ?, ?, ?, 'PENDING')`,
      [
        plate,
        vehicle?.id ?? null,
        eventType,
        description,
        confidence,
      ]
    );

    return NextResponse.json(
      {
        id: result.insertId,
        plate_number: plate,
        vehicle_id: vehicle?.id ?? null,
        registered: Boolean(vehicle),
        event_type: eventType,
        review_status: "PENDING",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST traffic event error:", error);
    return NextResponse.json(
      { message: "Failed to save traffic event." },
      { status: 500 }
    );
  }
}
