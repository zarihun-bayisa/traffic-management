import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

const reportViews = ["periodic", "daily", "penalties", "summary", "status", "cameras"] as const;
type ReportView = (typeof reportViews)[number];

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const requestedView = params.get("view") ?? "periodic";
  if (!reportViews.includes(requestedView as ReportView)) {
    return NextResponse.json({ message: "Choose a valid report type." }, { status: 400 });
  }
  const view = requestedView as ReportView;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const status = params.get("status")?.trim() ?? "";
  const eventType = params.get("eventType")?.trim() ?? "";
  const vehicleType = params.get("vehicleType")?.trim() ?? "";
  const cameraId = params.get("cameraId")?.trim() ?? "";
  const search = params.get("search")?.trim() ?? "";

  if ((from && !validDate(from)) || (to && !validDate(to))) {
    return NextResponse.json({ message: "Enter valid report dates." }, { status: 400 });
  }
  if (from && to && from > to) {
    return NextResponse.json({ message: "The start date must be on or before the end date." }, { status: 400 });
  }

  try {
    let rows: RowDataPacket[];

    if (view === "cameras") {
      const eventConditions: string[] = [];
      const values: Array<string | number> = [];
      if (from) { eventConditions.push("e.detected_at >= ?"); values.push(`${from} 00:00:00`); }
      if (to) { eventConditions.push("e.detected_at < DATE_ADD(?, INTERVAL 1 DAY)"); values.push(`${to} 00:00:00`); }
      const eventJoinFilter = eventConditions.length ? `AND ${eventConditions.join(" AND ")}` : "";
      const where: string[] = [];
      if (status) { where.push("c.status = ?"); values.push(status); }
      if (cameraId) { where.push("c.id = ?"); values.push(Number(cameraId)); }
      if (search) {
        where.push("(c.camera_code LIKE ? OR c.camera_name LIKE ? OR c.location LIKE ? OR c.road_name LIKE ?)");
        const term = `%${search}%`;
        values.push(term, term, term, term);
      }
      const [cameraRows] = await db.query<RowDataPacket[]>(
        `SELECT c.id, c.camera_code, c.camera_name, c.location, c.road_name,
                c.camera_type, c.status, COUNT(e.id) AS event_count,
                MAX(e.detected_at) AS latest_event
         FROM cameras c
         LEFT JOIN traffic_events e ON e.camera_id = c.id ${eventJoinFilter}
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         GROUP BY c.id, c.camera_code, c.camera_name, c.location, c.road_name, c.camera_type, c.status
         ORDER BY event_count DESC, c.camera_name
         LIMIT 1000`,
        values
      );
      rows = cameraRows;
    } else if (view === "summary" || view === "status") {
      const where: string[] = [];
      const values: string[] = [];
      if (from) { where.push("detected_at >= ?"); values.push(`${from} 00:00:00`); }
      if (to) { where.push("detected_at < DATE_ADD(?, INTERVAL 1 DAY)"); values.push(`${to} 00:00:00`); }
      const groupColumn = view === "summary" ? "event_type" : "review_status";
      const [summaryRows] = await db.query<RowDataPacket[]>(
        `SELECT ${groupColumn} AS label, COUNT(*) AS event_count,
                COUNT(DISTINCT vehicle_id) AS matched_vehicles,
                ROUND(AVG(confidence) * 100, 1) AS average_confidence,
                MAX(detected_at) AS latest_event
         FROM traffic_events
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         GROUP BY ${groupColumn}
         ORDER BY event_count DESC`,
        values
      );
      rows = summaryRows;
    } else if (view === "penalties") {
      const where = ["p.status IN ('ISSUED', 'REJECTED')"];
      const values: Array<string | number> = [];
      if (from) { where.push("e.detected_at >= ?"); values.push(`${from} 00:00:00`); }
      if (to) { where.push("e.detected_at < DATE_ADD(?, INTERVAL 1 DAY)"); values.push(`${to} 00:00:00`); }
      if (status) { where.push("p.payment_status = ?"); values.push(status); }
      if (eventType) { where.push("p.violation_name = ?"); values.push(eventType); }
      if (vehicleType) { where.push("v.vehicle_type = ?"); values.push(vehicleType); }
      if (search) {
        where.push("(p.plate_number LIKE ? OR d.full_name LIKE ? OR p.violation_name LIKE ?)");
        const term = `%${search}%`;
        values.push(term, term, term);
      }
      const [penaltyRows] = await db.query<RowDataPacket[]>(
        `SELECT p.id, p.event_id, p.plate_number, p.violation_name,
                p.amount, p.currency, p.status AS penalty_status,
                p.payment_status, p.paid_at, e.detected_at,
                d.full_name AS driver_name, d.license_number,
                v.vehicle_type, v.owner_name
         FROM penalties p
         INNER JOIN traffic_events e ON e.id = p.event_id
         LEFT JOIN vehicles v ON v.id = p.vehicle_id
         LEFT JOIN vehicle_driver_agreements a
           ON a.vehicle_id = p.vehicle_id
          AND DATE(e.detected_at) >= a.start_date
          AND (a.end_date IS NULL OR DATE(e.detected_at) <= a.end_date)
         LEFT JOIN drivers d ON d.id = a.driver_id
         WHERE ${where.join(" AND ")}
         ORDER BY e.detected_at DESC
         LIMIT 1000`,
        values
      );
      rows = penaltyRows;
    } else {
      const where: string[] = [];
      const values: Array<string | number> = [];
      if (from) { where.push("e.detected_at >= ?"); values.push(`${from} 00:00:00`); }
      if (to) { where.push("e.detected_at < DATE_ADD(?, INTERVAL 1 DAY)"); values.push(`${to} 00:00:00`); }
      if (view === "daily" && !from && !to) where.push("DATE(e.detected_at) = CURRENT_DATE()");
      if (status) { where.push("e.review_status = ?"); values.push(status); }
      if (eventType) { where.push("e.event_type = ?"); values.push(eventType); }
      if (vehicleType) { where.push("v.vehicle_type = ?"); values.push(vehicleType); }
      if (cameraId) { where.push("e.camera_id = ?"); values.push(Number(cameraId)); }
      if (search) {
        where.push("(e.plate_number LIKE ? OR d.full_name LIKE ? OR c.camera_name LIKE ? OR v.owner_name LIKE ?)");
        const term = `%${search}%`;
        values.push(term, term, term, term);
      }
      const [eventRows] = await db.query<RowDataPacket[]>(
        `SELECT e.id, e.plate_number, e.event_type, e.description,
                e.confidence, e.review_status, e.detected_at,
                c.camera_name, c.camera_code, c.location AS camera_location,
                d.full_name AS driver_name, d.license_number,
                v.vehicle_type, v.make, v.model, v.owner_name
         FROM traffic_events e
         LEFT JOIN cameras c ON c.id = e.camera_id
         LEFT JOIN vehicles v ON v.id = e.vehicle_id
         LEFT JOIN vehicle_driver_agreements a
           ON a.vehicle_id = e.vehicle_id
          AND DATE(e.detected_at) >= a.start_date
          AND (a.end_date IS NULL OR DATE(e.detected_at) <= a.end_date)
         LEFT JOIN drivers d ON d.id = a.driver_id
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY e.detected_at DESC
         LIMIT 1000`,
        values
      );
      rows = eventRows;
    }

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Load report data error:", error);
    return NextResponse.json({ message: "Could not load report data." }, { status: 500 });
  }
}