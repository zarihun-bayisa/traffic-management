
import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";

type Camera = RowDataPacket & {
  id: number;
  camera_code: string;
  camera_name: string;
  location: string;
  road_name: string | null;
  ip_address: string | null;
  camera_type: string;
  status: string;
  created_at: Date;
  updated_at: Date;
};

const allowedStatuses = ["ONLINE", "OFFLINE", "MAINTENANCE"];
const allowedTypes = ["ANPR", "CCTV", "RED_LIGHT", "SPEED", "OTHER"];

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";

    let sql = `
      SELECT id, camera_code, camera_name, location,
             road_name, ip_address, camera_type, status,
             created_at, updated_at
      FROM cameras
    `;

    const values: string[] = [];

    if (search) {
      sql += `
        WHERE camera_code LIKE ?
           OR camera_name LIKE ?
           OR location LIKE ?
           OR road_name LIKE ?
      `;

      const term = `%${search}%`;
      values.push(term, term, term, term);
    }

    sql += " ORDER BY created_at DESC";

    const [rows] = await db.query<Camera[]>(sql, values);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/cameras error:", error);

    return NextResponse.json(
      { message: "Failed to load cameras." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const camera_code = String(body.camera_code ?? "").trim();
    const camera_name = String(body.camera_name ?? "").trim();
    const location = String(body.location ?? "").trim();
    const road_name = String(body.road_name ?? "").trim();
    const ip_address = String(body.ip_address ?? "").trim();
    const camera_type = String(body.camera_type ?? "ANPR").trim().toUpperCase();
    const status = String(body.status ?? "OFFLINE").trim().toUpperCase();

    if (!camera_code || !camera_name || !location) {
      return NextResponse.json(
        { message: "Camera code, name, and location are required." },
        { status: 400 }
      );
    }

    if (!allowedTypes.includes(camera_type)) {
      return NextResponse.json(
        { message: "Invalid camera type." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { message: "Invalid camera status." },
        { status: 400 }
      );
    }

    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO cameras
        (camera_code, camera_name, location, road_name,
         ip_address, camera_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        camera_code,
        camera_name,
        location,
        road_name || null,
        ip_address || null,
        camera_type,
        status,
      ]
    );

    return NextResponse.json(
      {
        message: "Camera registered successfully.",
        id: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    const err = error as { code?: string };

    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "A camera with this code already exists." },
        { status: 409 }
      );
    }

    console.error("POST /api/cameras error:", error);

    return NextResponse.json(
      { message: "Failed to register camera." },
      { status: 500 }
    );
  }
}
