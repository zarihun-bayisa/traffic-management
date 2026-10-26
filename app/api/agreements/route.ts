import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

const agreementStatuses = ["ACTIVE", "UPCOMING", "COMPLETED", "CANCELLED"] as const;

type AgreementRow = RowDataPacket & {
  id: number;
  vehicle_id: number;
  driver_id: number;
  plate_number: string;
  owner_name: string | null;
  driver_name: string;
  license_number: string | null;
  phone_number: string;
  vehicle_type: string;
  amount: string;
  vat_amount: string;
  total_amount: string;
  currency: string;
  start_date: string;
  end_date: string | null;
  status: (typeof agreementStatuses)[number];
  created_at: Date;
};

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function GET() {
  try {
    const [rows] = await db.query<AgreementRow[]>(
      `SELECT a.id, a.vehicle_id, a.driver_id, a.amount, a.vat_amount,
              a.total_amount, a.currency, a.start_date, a.end_date, a.status,
              a.created_at, v.plate_number, v.owner_name,
              d.full_name AS driver_name, d.license_number, d.phone_number,
              d.vehicle_type
       FROM vehicle_driver_agreements a
       INNER JOIN vehicles v ON v.id = a.vehicle_id
       INNER JOIN drivers d ON d.id = a.driver_id
       ORDER BY CASE WHEN a.status = 'ACTIVE' THEN 0 WHEN a.status = 'UPCOMING' THEN 1 ELSE 2 END,
                a.start_date DESC, a.id DESC
       LIMIT 500`
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Load agreements error:", error);
    return NextResponse.json({ message: "Could not load agreements." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let connection;
  try {
    const body = await request.json();
    const vehicleId = Number(body.vehicle_id);
    const driverId = Number(body.driver_id);
    const amount = Number(body.amount);
    const vatAmount = Number(body.vat_amount ?? 0);
    const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "ETB";
    const startDate = body.start_date;
    const endDate = body.end_date === "" || body.end_date == null ? null : body.end_date;

    if (!Number.isSafeInteger(vehicleId) || vehicleId <= 0 || !Number.isSafeInteger(driverId) || driverId <= 0) {
      return NextResponse.json({ message: "Choose a vehicle and driver." }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999.99 || !Number.isFinite(vatAmount) || vatAmount < 0 || vatAmount > 99999999.99) {
      return NextResponse.json({ message: "Enter valid agreement and VAT amounts." }, { status: 400 });
    }
    if (!/^[A-Z]{3}$/.test(currency) || !isDateOnly(startDate) || (endDate !== null && !isDateOnly(endDate))) {
      return NextResponse.json({ message: "Enter a valid currency and agreement dates." }, { status: 400 });
    }
    if (endDate !== null && endDate < startDate) {
      return NextResponse.json({ message: "The end date must be on or after the start date." }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const status = startDate > today ? "UPCOMING" : "ACTIVE";
    const totalAmount = Math.round((amount + vatAmount + Number.EPSILON) * 100) / 100;

    connection = await db.getConnection();
    await connection.beginTransaction();
    const [vehicles] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM vehicles WHERE id = ? AND is_deleted = 0 FOR UPDATE",
      [vehicleId]
    );
    const [drivers] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM drivers WHERE id = ? FOR UPDATE",
      [driverId]
    );
    if (!vehicles[0] || !drivers[0]) {
      await connection.rollback();
      return NextResponse.json({ message: "The selected vehicle or driver was not found." }, { status: 404 });
    }

    const [conflicts] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM vehicle_driver_agreements
       WHERE status IN ('ACTIVE', 'UPCOMING')
         AND (vehicle_id = ? OR driver_id = ?)
         AND (end_date IS NULL OR end_date >= ?)
         AND (? IS NULL OR start_date <= ?)
       LIMIT 1 FOR UPDATE`,
      [vehicleId, driverId, startDate, endDate, endDate]
    );
    if (conflicts.length) {
      await connection.rollback();
      return NextResponse.json({ message: "This vehicle or driver already has an overlapping active agreement." }, { status: 409 });
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO vehicle_driver_agreements
       (vehicle_id, driver_id, amount, vat_amount, total_amount, currency, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [vehicleId, driverId, amount, vatAmount, totalAmount, currency, startDate, endDate, status]
    );
    await connection.commit();
    return NextResponse.json({ id: result.insertId, message: "Agreement created." }, { status: 201 });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Create agreement error:", error);
    return NextResponse.json({ message: "Could not create agreement." }, { status: 500 });
  } finally {
    connection?.release();
  }
}