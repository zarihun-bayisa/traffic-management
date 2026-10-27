import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

type PaymentRow = RowDataPacket & {
  id: number;
  event_id: number;
  vehicle_id: number | null;
  plate_number: string;
  violation_name: string;
  amount: string;
  currency: string;
  payment_status: "UNPAID" | "PAID";
  paid_at: Date | null;
  created_at: Date;
  detected_at: Date;
  driver_name: string | null;
  driver_license: string | null;
  driver_phone: string | null;
};

export async function GET() {
  try {
    const [rows] = await db.query<PaymentRow[]>(
      `SELECT p.id, p.event_id, p.vehicle_id, p.plate_number, p.violation_name,
              p.amount, p.currency, p.payment_status, p.paid_at, p.created_at,
              e.detected_at, d.full_name AS driver_name,
              d.license_number AS driver_license, d.phone_number AS driver_phone
       FROM penalties p
       INNER JOIN traffic_events e ON e.id = p.event_id
       LEFT JOIN vehicle_driver_agreements a
         ON a.vehicle_id = p.vehicle_id
        AND DATE(e.detected_at) >= a.start_date
        AND (a.end_date IS NULL OR DATE(e.detected_at) <= a.end_date)
       LEFT JOIN drivers d ON d.id = a.driver_id
       WHERE p.status = 'ISSUED'
       ORDER BY CASE WHEN p.payment_status = 'UNPAID' THEN 0 ELSE 1 END,
                e.detected_at DESC
       LIMIT 500`
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Load payments error:", error);
    return NextResponse.json({ message: "Could not load payments." }, { status: 500 });
  }
}