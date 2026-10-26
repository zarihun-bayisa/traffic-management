import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addVehicleHistory } from "@/lib/vehicle-history";
import type { RowDataPacket } from "mysql2/promise";

const validStatuses = ["Available", "In Use", "Maintenance", "Inactive"];

function parseVehicleId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: RouteContext<"/api/vehicles/[id]">) {
  const { id: rawId } = await context.params;
  const id = parseVehicleId(rawId);
  if (!id) return NextResponse.json({ message: "Invalid vehicle id" }, { status: 400 });

  let connection;
  try {
    const body = await request.json();
    const { plate_number, owner_name, make, model, vehicle_type, status } = body;
    if (
      (owner_name !== undefined && owner_name !== null && typeof owner_name !== "string") ||
      (typeof owner_name === "string" && owner_name.trim().length > 160) ||
      typeof plate_number !== "string" || !plate_number.trim() ||
      typeof make !== "string" || !make.trim() ||
      typeof model !== "string" || !model.trim() ||
      !validStatuses.includes(status)
    ) {
      return NextResponse.json({ message: "Complete valid vehicle details are required" }, { status: 400 });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT plate_number, owner_name, make, model, vehicle_type, status FROM vehicles WHERE id = ? AND is_deleted = 0 FOR UPDATE",
      [id]
    );
    if (!rows[0]) {
      await connection.rollback();
      return NextResponse.json({ message: "Vehicle not found" }, { status: 404 });
    }

    const before = rows[0];
    const after = {
      plate_number: plate_number.trim().toUpperCase(),
      owner_name: typeof owner_name === "string" ? owner_name.trim() || null : before.owner_name ?? null,
      make: make.trim(),
      model: model.trim(),
      vehicle_type: vehicle_type || null,
      status,
    };
    await connection.execute(
      `UPDATE vehicles
      SET plate_number = ?, owner_name = ?, make = ?, model = ?, vehicle_type = ?, status = ?
       WHERE id = ?`,
          [after.plate_number, after.owner_name, after.make, after.model, after.vehicle_type, after.status, id]
    );
    await addVehicleHistory(connection, id, before.status === status ? "updated" : "status_changed", {
      before,
      after,
    });
    await connection.commit();
    return NextResponse.json({ message: "Vehicle updated" });
  } catch (error) {
    if (connection) await connection.rollback();
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "This plate number is already registered" }, { status: 409 });
    }
    console.error("Update vehicle error:", error);
    return NextResponse.json({ message: "Could not update vehicle" }, { status: 500 });
  } finally {
    connection?.release();
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/vehicles/[id]">) {
  const { id: rawId } = await context.params;
  const id = parseVehicleId(rawId);
  if (!id) return NextResponse.json({ message: "Invalid vehicle id" }, { status: 400 });

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.execute(
      "UPDATE vehicles SET is_deleted = 1 WHERE id = ? AND is_deleted = 0",
      [id]
    );
    if ((result as { affectedRows: number }).affectedRows === 0) {
      await connection.rollback();
      return NextResponse.json({ message: "Vehicle not found" }, { status: 404 });
    }
    await addVehicleHistory(connection, id, "deleted", {});
    await connection.commit();
    return NextResponse.json({ message: "Vehicle archived" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Archive vehicle error:", error);
    return NextResponse.json({ message: "Could not archive vehicle" }, { status: 500 });
  } finally {
    connection?.release();
  }
}