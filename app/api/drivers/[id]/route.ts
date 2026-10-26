
import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2/promise";
import { db } from "@/lib/db";
type Context = {
  params: Promise<{ id: string }>;
};

async function getId(context: Context) {
  const { id } = await context.params;

  if (!/^[1-9]\d*$/.test(id)) return null;

  const parsed = Number(id);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const id = await getId(context);

    if (!id) {
      return NextResponse.json({ message: "Invalid driver ID." }, { status: 400 });
    }

    const body = await request.json();
    const fullName =
      typeof body.full_name === "string" ? body.full_name.trim() : "";
    const plateNumber =
      typeof body.plate_number === "string"
        ? body.plate_number.trim().toUpperCase()
        : "";
    const licenseNumber =
      typeof body.license_number === "string"
        ? body.license_number.trim().toUpperCase()
        : "";
    const vehicleType =
      typeof body.vehicle_type === "string" ? body.vehicle_type.trim() : "";
    const phoneNumber =
      typeof body.phone_number === "string" ? body.phone_number.trim() : "";

    if (!fullName || !plateNumber || !licenseNumber || !vehicleType || !phoneNumber) {
      return NextResponse.json(
        { message: "Please fill in all five fields." },
        { status: 400 }
      );
    }

    if (
      fullName.length > 160 ||
      plateNumber.length > 20 ||
      licenseNumber.length > 50 ||
      vehicleType.length > 50 ||
      phoneNumber.length > 30
    ) {
      return NextResponse.json(
        { message: "One or more fields are too long." },
        { status: 400 }
      );
    }

    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE drivers
         SET full_name = ?, plate_number = ?, license_number = ?,
           vehicle_type = ?, phone_number = ?
       WHERE id = ?`,
        [fullName, plateNumber, licenseNumber, vehicleType, phoneNumber, id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ message: "Driver not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Driver updated successfully." });
  } catch (error) {
    console.error("Update driver error:", error);
    return NextResponse.json(
      { message: "Could not update driver." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const id = await getId(context);

    if (!id) {
      return NextResponse.json({ message: "Invalid driver ID." }, { status: 400 });
    }

    const [result] = await db.execute<ResultSetHeader>(
      "DELETE FROM drivers WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ message: "Driver not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Driver deleted successfully." });
  } catch (error) {
    console.error("Delete driver error:", error);
    return NextResponse.json(
      { message: "Could not delete driver." },
      { status: 500 }
    );
  }
}
