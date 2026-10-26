
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
};

const allowedStatuses = ["ONLINE", "OFFLINE", "MAINTENANCE"];
const allowedTypes = ["ANPR", "CCTV", "RED_LIGHT", "SPEED", "OTHER"];

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getCameraId(context: RouteContext) {
  const { id } = await context.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return null;
  }

  const parsed = Number(id);

  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const id = await getCameraId(context);

    if (id === null) {
      return NextResponse.json(
        { message: "Invalid camera ID." },
        { status: 400 }
      );
    }

    const [rows] = await db.execute<Camera[]>(
      "SELECT * FROM cameras WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { message: "Camera not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("GET camera error:", error);

    return NextResponse.json(
      { message: "Failed to load camera." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const id = await getCameraId(context);

    if (id === null) {
      return NextResponse.json(
        { message: "Invalid camera ID." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const camera_code = String(body.camera_code ?? "").trim();
    const camera_name = String(body.camera_name ?? "").trim();
    const location = String(body.location ?? "").trim();
    const road_name = String(body.road_name ?? "").trim();
    const ip_address = String(body.ip_address ?? "").trim();
    const camera_type = String(body.camera_type ?? "").trim().toUpperCase();
    const status = String(body.status ?? "").trim().toUpperCase();

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
      `UPDATE cameras
       SET camera_code = ?, camera_name = ?, location = ?,
           road_name = ?, ip_address = ?, camera_type = ?, status = ?
       WHERE id = ?`,
      [
        camera_code,
        camera_name,
        location,
        road_name || null,
        ip_address || null,
        camera_type,
        status,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      const [rows] = await db.execute<Camera[]>(
        "SELECT id FROM cameras WHERE id = ?",
        [id]
      );

      if (rows.length === 0) {
        return NextResponse.json(
          { message: "Camera not found." },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      message: "Camera updated successfully.",
    });
  } catch (error) {
    const err = error as { code?: string };

    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "Another camera already uses this code." },
        { status: 409 }
      );
    }

    console.error("PUT camera error:", error);

    return NextResponse.json(
      { message: "Failed to update camera." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const id = await getCameraId(context);

    if (id === null) {
      return NextResponse.json(
        { message: "Invalid camera ID." },
        { status: 400 }
      );
    }

    const [result] = await db.execute<ResultSetHeader>(
      "DELETE FROM cameras WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: "Camera not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Camera deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE camera error:", error);

    return NextResponse.json(
      { message: "Failed to delete camera." },
      { status: 500 }
    );
  }
}
