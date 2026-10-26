import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

const maxFileSize = 5 * 1024 * 1024;
const maxDriverRows = 500;

function normalizedHeader(value: ExcelJS.CellValue) {
  return typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
}

function cellText(value: ExcelJS.CellValue) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const drivers = workbook.addWorksheet("Drivers");
  drivers.columns = [
    { header: "Full Name", key: "fullName", width: 28 },
    { header: "Plate Number", key: "plateNumber", width: 20 },
    { header: "License Number", key: "licenseNumber", width: 24 },
    { header: "Vehicle Type", key: "vehicleType", width: 20 },
    { header: "Phone Number", key: "phoneNumber", width: 22 },
  ];
  drivers.getRow(1).font = { bold: true };
  drivers.autoFilter = "A1:E1";

  const instructions = workbook.addWorksheet("Instructions");
  instructions.addRows([
    ["Driver import template"],
    ["Enter one driver per row on the Drivers sheet."],
    ["All five fields are required: Full Name, Plate Number, License Number, Vehicle Type, and Phone Number."],
    ["Format plate, license, and phone numbers as text to preserve leading zeros."],
    [`Upload up to ${maxDriverRows} drivers per file. Duplicate license numbers or invalid rows reject the entire file.`],
  ]);
  instructions.getColumn(1).width = 105;
  instructions.getRow(1).font = { bold: true, size: 14 };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="driver-import-template.xlsx"',
    },
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ message: "Choose an .xlsx Excel file." }, { status: 400 });
  }
  if (file.size === 0 || file.size > maxFileSize) {
    return NextResponse.json({ message: "The Excel file must be between 1 byte and 5 MB." }, { status: 413 });
  }

  const workbook = new ExcelJS.Workbook();
  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await workbook.xlsx.load(fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    return NextResponse.json({ message: "This file could not be read as an Excel workbook." }, { status: 400 });
  }

  const worksheet = workbook.getWorksheet("Drivers") ?? workbook.worksheets[0];
  if (!worksheet || worksheet.actualRowCount < 2) {
    return NextResponse.json({ message: "The workbook has no driver rows to import." }, { status: 400 });
  }

  const headers = new Map<string, number>();
  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = normalizedHeader(cell.value);
    if (header) headers.set(header, columnNumber);
  });
  const fullNameColumn = headers.get("fullname") ?? headers.get("drivername");
  const plateColumn = headers.get("platenumber") ?? headers.get("plate");
  const licenseColumn = headers.get("licensenumber") ?? headers.get("license");
  const vehicleTypeColumn = headers.get("vehicletype") ?? headers.get("type");
  const phoneColumn = headers.get("phonenumber") ?? headers.get("phone");
  if (!fullNameColumn || !plateColumn || !licenseColumn || !vehicleTypeColumn || !phoneColumn) {
    return NextResponse.json({
      message: "The first row must include Full Name, Plate Number, License Number, Vehicle Type, and Phone Number columns.",
    }, { status: 400 });
  }

  const driversToImport: Array<{
    fullName: string;
    plateNumber: string;
    licenseNumber: string;
    vehicleType: string;
    phoneNumber: string;
    rowNumber: number;
  }> = [];
  const errors: string[] = [];
  const seenLicenses = new Set<string>();
  let rowCount = 0;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const fullName = cellText(row.getCell(fullNameColumn).value);
    const plateNumber = cellText(row.getCell(plateColumn).value).toUpperCase();
    const licenseNumber = cellText(row.getCell(licenseColumn).value).toUpperCase();
    const vehicleType = cellText(row.getCell(vehicleTypeColumn).value);
    const phoneNumber = cellText(row.getCell(phoneColumn).value);
    if (!fullName && !plateNumber && !licenseNumber && !vehicleType && !phoneNumber) return;

    rowCount += 1;
    if (rowCount > maxDriverRows) {
      if (errors.length === 0) errors.push(`The workbook exceeds the ${maxDriverRows}-driver limit.`);
      return;
    }

    const rowErrors: string[] = [];
    if (!fullName || !plateNumber || !licenseNumber || !vehicleType || !phoneNumber) {
      rowErrors.push("All five fields are required.");
    }
    if (fullName.length > 160 || plateNumber.length > 20 || licenseNumber.length > 50 || vehicleType.length > 50 || phoneNumber.length > 30) {
      rowErrors.push("One or more fields exceed the allowed length.");
    }
    if (licenseNumber && seenLicenses.has(licenseNumber)) {
      rowErrors.push(`License number ${licenseNumber} appears more than once in the file.`);
    }
    if (licenseNumber) seenLicenses.add(licenseNumber);

    if (rowErrors.length) {
      errors.push(`Row ${rowNumber}: ${rowErrors.join(" ")}`);
      return;
    }

    driversToImport.push({ fullName, plateNumber, licenseNumber, vehicleType, phoneNumber, rowNumber });
  });

  if (rowCount === 0) {
    return NextResponse.json({ message: "The workbook has no driver rows to import." }, { status: 400 });
  }
  if (errors.length) {
    return NextResponse.json({
      message: "No drivers were imported. Correct the listed spreadsheet rows and try again.",
      errors: errors.slice(0, 50),
    }, { status: 400 });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const placeholders = driversToImport.map(() => "?").join(", ");
    const [existingRows] = await connection.execute<RowDataPacket[]>(
      `SELECT license_number FROM drivers WHERE license_number IN (${placeholders})`,
      driversToImport.map((driver) => driver.licenseNumber)
    );
    if (existingRows.length) {
      await connection.rollback();
      return NextResponse.json({
        message: "No drivers were imported because these license numbers already exist.",
        duplicates: existingRows.map((row) => String(row.license_number)),
      }, { status: 409 });
    }

    for (const driver of driversToImport) {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO drivers (full_name, plate_number, license_number, vehicle_type, phone_number)
         VALUES (?, ?, ?, ?, ?)`,
        [driver.fullName, driver.plateNumber, driver.licenseNumber, driver.vehicleType, driver.phoneNumber]
      );
    }
    await connection.commit();
    return NextResponse.json({
      message: `${driversToImport.length} drivers imported successfully.`,
      imported: driversToImport.length,
    }, { status: 201 });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Import drivers error:", error);
    return NextResponse.json({ message: "Could not import drivers." }, { status: 500 });
  } finally {
    connection?.release();
  }
}