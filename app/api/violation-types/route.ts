import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

type ViolationTypeRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  description: string | null;
  amount: string;
  currency: string;
  active: number;
};

export async function GET() {
  try {
    const [rows] = await db.query<ViolationTypeRow[]>(
      `SELECT id, code, name, description, amount, currency, active
       FROM violation_types WHERE active = 1 ORDER BY name`
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Fetch violation types error:", error);
    return NextResponse.json({ message: "Could not load violation types." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const amount = Number(body.amount);
    const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "ETB";

    if (!name || name.length > 150) {
      return NextResponse.json({ message: "Enter a violation name up to 150 characters." }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999.99) {
      return NextResponse.json({ message: "Enter a valid penalty amount greater than zero." }, { status: 400 });
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json({ message: "Currency must be a three-letter code." }, { status: 400 });
    }

    const code = name.normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").toUpperCase().slice(0, 80);
    if (!code) {
      return NextResponse.json({ message: "The violation name must contain letters or numbers." }, { status: 400 });
    }

    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO violation_types (code, name, description, amount, currency)
       VALUES (?, ?, ?, ?, ?)`,
      [code, name, description ? description.slice(0, 500) : null, amount, currency]
    );
    return NextResponse.json({ id: result.insertId, message: "Violation type created." }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "A violation type with this name already exists." }, { status: 409 });
    }
    console.error("Create violation type error:", error);
    return NextResponse.json({ message: "Could not create violation type." }, { status: 500 });
  }
}