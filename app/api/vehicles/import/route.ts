import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addVehicleHistory } from "@/lib/vehicle-history";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

const maxFileSize = 5 * 1024 * 1024;
const maxVehicleRows = 500;
const vehicleTypes = ["Private", "Taxi", "Bus", "Truck", "Motorcycle", "Government"] as const;
const statuses = ["Available", "In Use", "Maintenance", "Inactive"] as const;

function normalizedHeader(value: ExcelJS.CellValue) {
  return typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
}

function cellText(value: ExcelJS.CellValue) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const vehicles = workbook.addWorksheet("Vehicles");
  vehicles.columns = [
    { header: "Plate Number", key: "plate", width: 22 },
    { header: "Owner Name", key: "ownerName", width: 26 },
    { header: "Make", key: "make", width: 20 },
    { header: "Model", key: "model", width: 20 },
    { header: "Vehicle Type", key: "type", width: 20 },
    { header: "Status", key: "status", width: 18 },
  ];
  vehicles.getRow(1).font = { bold: true };
  vehicles.autoFilter = "A1:F1";

  const instructions = workbook.addWorksheet("Instructions");
  instructions.addRows([
    ["Vehicle import template"],
    ["Enter one vehicle per row on the Vehicles sheet."],
    ["Plate Number, Make, and Model are required. Owner Name is optional. Format plate numbers as text to preserve leading zeros."],
    ["Vehicle Type options: Private, Taxi, Bus, Truck, Motorcycle, Government. Blank defaults to Private."],
    ["Status options: Available, In Use, Maintenance, Inactive. Blank defaults to Available."],
    [`Upload up to ${maxVehicleRows} vehicles per file. Duplicate plate numbers or invalid rows reject the entire file.`],
  ]);
  instructions.getColumn(1).width = 110;
  instructions.getRow(1).font = { bold: true, size: 14 };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="vehicle-import-template.xlsx"',
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

  const worksheet = workbook.getWorksheet("Vehicles") ?? workbook.worksheets[0];
  if (!worksheet || worksheet.actualRowCount < 2) {
    return NextResponse.json({ message: "The workbook has no vehicle rows to import." }, { status: 400 });
  }

  const headers = new Map<string, number>();
  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = normalizedHeader(cell.value);
    if (header) headers.set(header, columnNumber);
  });
  const plateColumn = headers.get("platenumber") ?? headers.get("plate");
  const ownerColumn = headers.get("ownername");
  const makeColumn = headers.get("make");
  const modelColumn = headers.get("model");
  const typeColumn = headers.get("vehicletype") ?? headers.get("type");
  const statusColumn = headers.get("status");
  if (!plateColumn || !makeColumn || !modelColumn) {
    return NextResponse.json({
      message: "The first row must include Plate Number, Make, and Model columns.",
    }, { status: 400 });
  }

  const vehiclesToImport: Array<{
    plate: string;
    ownerName: string;
    make: string;
    model: string;
    type: string;
    status: (typeof statuses)[number];
    rowNumber: number;
  }> = [];
  const errors: string[] = [];
  const seenPlates = new Set<string>();
  let rowCount = 0;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const plate = cellText(row.getCell(plateColumn).value).toUpperCase();
    const ownerName = ownerColumn ? cellText(row.getCell(ownerColumn).value) : "";
    const make = cellText(row.getCell(makeColumn).value);
    const model = cellText(row.getCell(modelColumn).value);
    const type = typeColumn ? cellText(row.getCell(typeColumn).value) || "Private" : "Private";
    const rawStatus = statusColumn ? cellText(row.getCell(statusColumn).value) : "";
    if (!plate && !ownerName && !make && !model && !rawStatus && type === "Private") return;

    rowCount += 1;
    if (rowCount > maxVehicleRows) {
      if (errors.length === 0) errors.push(`The workbook exceeds the ${maxVehicleRows}-vehicle limit.`);
      return;
    }

    const rowErrors: string[] = [];
    if (!plate || !make || !model) rowErrors.push("Plate Number, Make, and Model are required.");
    if (ownerName.length > 160) rowErrors.push("Owner Name must be 160 characters or fewer.");
    if (plate && seenPlates.has(plate)) rowErrors.push(`Plate ${plate} appears more than once in the file.`);
    if (plate) seenPlates.add(plate);
    if (!vehicleTypes.some((candidate) => candidate.toLowerCase() === type.toLowerCase())) {
      rowErrors.push(`Vehicle Type must be one of: ${vehicleTypes.join(", ")}.`);
    }

    const normalizedStatus = rawStatus.toLowerCase();
    const status = rawStatus
      ? statuses.find((candidate) => candidate.toLowerCase() === normalizedStatus)
      : "Available";
    if (!status) rowErrors.push(`Status must be one of: ${statuses.join(", ")}.`);

    if (rowErrors.length) {
      errors.push(`Row ${rowNumber}: ${rowErrors.join(" ")}`);
      return;
    }

    vehiclesToImport.push({ plate, ownerName, make, model, type, status: status ?? "Available", rowNumber });
  });

  if (rowCount === 0) {
    return NextResponse.json({ message: "The workbook has no vehicle rows to import." }, { status: 400 });
  }
  if (errors.length) {
    return NextResponse.json({
      message: "No vehicles were imported. Correct the listed spreadsheet rows and try again.",
      errors: errors.slice(0, 50),
    }, { status: 400 });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const platePlaceholders = vehiclesToImport.map(() => "?").join(", ");
    const [existingRows] = await connection.execute<RowDataPacket[]>(
      `SELECT plate_number FROM vehicles WHERE plate_number IN (${platePlaceholders})`,
      vehiclesToImport.map((vehicle) => vehicle.plate)
    );
    if (existingRows.length) {
      await connection.rollback();
      const duplicates = existingRows.map((row) => String(row.plate_number));
      return NextResponse.json({
        message: "No vehicles were imported because these plate numbers are already registered.",
        duplicates,
      }, { status: 409 });
    }

    for (const vehicle of vehiclesToImport) {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO vehicles (plate_number, owner_name, make, model, vehicle_type, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [vehicle.plate, vehicle.ownerName || null, vehicle.make, vehicle.model, vehicle.type, vehicle.status]
      );
      await addVehicleHistory(connection, result.insertId, "created", {
        plate: vehicle.plate,
        owner_name: vehicle.ownerName || null,
        make: vehicle.make,
        model: vehicle.model,
        type: vehicle.type,
        status: vehicle.status,
        source: "excel_import",
        spreadsheet_row: vehicle.rowNumber,
      });
    }

    await connection.commit();
    return NextResponse.json({
      message: `${vehiclesToImport.length} vehicles imported successfully.`,
      imported: vehiclesToImport.length,
    }, { status: 201 });
  } catch (error) {
    if (connection) await connection.rollback();
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({
        message: "No vehicles were imported because a plate number is already registered.",
      }, { status: 409 });
    }
    console.error("Import vehicles error:", error);
    return NextResponse.json({ message: "Could not import vehicles." }, { status: 500 });
  } finally {
    connection?.release();
  }
}