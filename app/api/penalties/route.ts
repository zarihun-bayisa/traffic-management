import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

type PenaltyRow = RowDataPacket & {
  id: number;
  event_id: number;
  vehicle_id: number | null;
  plate_number: string;
  violation_name: string;
  amount: string;
  currency: string;
  status: string;
  created_at: Date;
  reviewed_at: Date | null;
  owner_name: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  detected_at: Date;
};

export async function GET() {
  try {
    const [rows] = await db.query<PenaltyRow[]>(
      `SELECT p.id, p.event_id, p.vehicle_id, p.plate_number, p.violation_name,
              p.amount, p.currency, p.status, p.created_at, p.reviewed_at,
              v.owner_name, v.make AS vehicle_make, v.model AS vehicle_model,
              e.detected_at
       FROM penalties p
       LEFT JOIN vehicles v ON v.id = p.vehicle_id
       INNER JOIN traffic_events e ON e.id = p.event_id
       ORDER BY CASE WHEN p.status = 'PENDING_REVIEW' THEN 0 ELSE 1 END,
                p.created_at DESC
       LIMIT 300`
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Fetch penalties error:", error);
    return NextResponse.json({ message: "Could not load penalties." }, { status: 500 });
  }
}