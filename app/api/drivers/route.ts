
import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";

type Driver = RowDataPacket & {
  id: number;
  full_name: string;
  plate_number: string;
  license_number: string | null;
  vehicle_type: string;
  phone_number: string;
  created_at: Date;
};

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const term = `%${search}%`;

    const [rows] = await db.execute<Driver[]>(
        `SELECT id, full_name, plate_number, license_number, vehicle_type,
              phone_number, created_at
       FROM drivers
       WHERE full_name LIKE ?
          OR plate_number LIKE ?
          OR license_number LIKE ?
          OR phone_number LIKE ?
       ORDER BY id DESC
       LIMIT 500`,
      [term, term, term, term]
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Load drivers error:", error);
    return NextResponse.json(
      { message: "Could not load drivers." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
      `INSERT INTO drivers
        (full_name, plate_number, license_number, vehicle_type, phone_number)
        VALUES (?, ?, ?, ?, ?)`,
            [fullName, plateNumber, licenseNumber, vehicleType, phoneNumber]
    );

    return NextResponse.json(
      { message: "Driver registered successfully.", id: result.insertId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register driver error:", error);
    return NextResponse.json(
      { message: "Could not register driver." },
      { status: 500 }
    );
  }
}
