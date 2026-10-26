
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addVehicleHistory } from "@/lib/vehicle-history";
import type { ResultSetHeader } from "mysql2/promise";

export async function GET() {
  try {
    const [rows] = await db.query(
            `SELECT id, plate_number AS plate, COALESCE(owner_name, '') AS owner_name, make, COALESCE(model, '') AS model,
              COALESCE(vehicle_type, '') AS type, status
       FROM vehicles WHERE is_deleted = 0 ORDER BY id DESC`
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Fetch vehicles error:", error);

    return NextResponse.json(
      { message: "Could not fetch vehicles" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let connection;

  try {
    const body = await request.json();
    const { plate_number, owner_name, make, model, vehicle_type, status } = body;

    if (
      (owner_name !== undefined && owner_name !== null && typeof owner_name !== "string") ||
      (typeof owner_name === "string" && owner_name.trim().length > 160) ||
      typeof plate_number !== "string" ||
      !plate_number.trim() ||
      typeof make !== "string" ||
      !make.trim() ||
      typeof model !== "string" ||
      !model.trim() ||
      !["Available", "In Use", "Maintenance", "Inactive"].includes(status)
    ) {
      return NextResponse.json(
        { message: "Plate, make, model, and a valid status are required" },
        { status: 400 }
      );
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    const normalizedOwnerName = typeof owner_name === "string" ? owner_name.trim() || null : null;
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO vehicles (plate_number, owner_name, make, model, vehicle_type, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [plate_number.trim().toUpperCase(), normalizedOwnerName, make.trim(), model.trim(), vehicle_type || null, status]
    );
    await addVehicleHistory(connection, result.insertId, "created", {
      plate: plate_number.trim().toUpperCase(),
      owner_name: normalizedOwnerName,
      make: make.trim(),
      model: model.trim(),
      type: vehicle_type || null,
      status,
    });
    await connection.commit();

    return NextResponse.json(
      {
        message: "Vehicle registered successfully",
        id: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    if (connection) await connection.rollback();

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      return NextResponse.json(
        { message: "This plate number is already registered" },
        { status: 409 }
      );
    }

    console.error("Register vehicle error:", error);

    return NextResponse.json(
      { message: "Could not register vehicle" },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
