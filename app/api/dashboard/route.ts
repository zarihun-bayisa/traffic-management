import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

type DashboardCounts = RowDataPacket & {
  registered_vehicles: number | string;
  active_agreements: number | string;
  traffic_cameras: number | string;
  recorded_violations: number | string;
  issued_penalties: number | string;
};

type VehicleStatusCount = RowDataPacket & {
  status: string;
  count: number | string;
};

type RecentEvent = RowDataPacket & {
  id: number;
  plate_number: string | null;
  event_type: string;
  review_status: string;
  confidence: number | null;
  detected_at: Date;
  owner_name: string | null;
  make: string | null;
  model: string | null;
};

export async function GET() {
  try {
    const [countRows] = await db.query<DashboardCounts[]>(
      `SELECT
         (SELECT COUNT(*) FROM vehicles WHERE is_deleted = 0) AS registered_vehicles,
         (SELECT COUNT(*) FROM vehicle_driver_agreements WHERE status = 'ACTIVE') AS active_agreements,
         (SELECT COUNT(*) FROM cameras) AS traffic_cameras,
         (SELECT COUNT(*) FROM traffic_events) AS recorded_violations,
         (SELECT COUNT(*) FROM penalties WHERE status = 'ISSUED') AS issued_penalties`
    );
    const [vehicleStatusRows] = await db.query<VehicleStatusCount[]>(
      `SELECT status, COUNT(*) AS count
       FROM vehicles WHERE is_deleted = 0
       GROUP BY status`
    );
    const [recentEvents] = await db.query<RecentEvent[]>(
      `SELECT e.id, e.plate_number, e.event_type, e.review_status,
              e.confidence, e.detected_at, v.owner_name, v.make, v.model
       FROM traffic_events e
       LEFT JOIN vehicles v ON v.id = e.vehicle_id
       ORDER BY e.detected_at DESC
       LIMIT 6`
    );

    const counts = countRows[0];
    return NextResponse.json({
      stats: {
        registeredVehicles: Number(counts?.registered_vehicles ?? 0),
        activeAgreements: Number(counts?.active_agreements ?? 0),
        trafficCameras: Number(counts?.traffic_cameras ?? 0),
        recordedViolations: Number(counts?.recorded_violations ?? 0),
        issuedPenalties: Number(counts?.issued_penalties ?? 0),
      },
      vehicleStatuses: vehicleStatusRows.map((row) => ({ status: row.status, count: Number(row.count) })),
      recentEvents,
    });
  } catch (error) {
    console.error("Load dashboard data error:", error);
    return NextResponse.json({ message: "Could not load dashboard data." }, { status: 500 });
  }
}