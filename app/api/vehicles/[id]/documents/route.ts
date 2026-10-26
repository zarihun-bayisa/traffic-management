import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addVehicleHistory } from "@/lib/vehicle-history";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

const maxFileSize = 10 * 1024 * 1024;
const mimeExtensions: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const privateDirectory = path.join(process.cwd(), "private_uploads", "vehicles");

function hasValidSignature(mimeType: string, bytes: Uint8Array) {
  if (mimeType === "application/pdf") return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (mimeType === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function GET(_request: Request, context: RouteContext<"/api/vehicles/[id]/documents">) {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ message: "Invalid vehicle id" }, { status: 400 });
  }

  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT id, document_type, original_filename, mime_type, size_bytes, uploaded_at
       FROM vehicle_documents WHERE vehicle_id = ? ORDER BY id DESC`,
      [id]
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Fetch vehicle documents error:", error);
    return NextResponse.json({ message: "Could not fetch vehicle documents" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext<"/api/vehicles/[id]/documents">) {
  const { id: rawId } = await context.params;
  const vehicleId = Number(rawId);
  if (!Number.isSafeInteger(vehicleId) || vehicleId <= 0) {
    return NextResponse.json({ message: "Invalid vehicle id" }, { status: 400 });
  }

  let connection;
  let savedPath: string | null = null;
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const documentType = formData.get("documentType");
    if (!file || typeof file === "string" || typeof documentType !== "string" || !documentType.trim()) {
      return NextResponse.json({ message: "Choose a document type and file" }, { status: 400 });
    }
    if (!mimeExtensions[file.type] || file.size === 0 || file.size > maxFileSize) {
      return NextResponse.json({ message: "Use a PDF or JPG, PNG, or WEBP image up to 10 MB" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidSignature(file.type, bytes)) {
      return NextResponse.json({ message: "The file content does not match its selected type" }, { status: 400 });
    }

    const storageName = `${randomUUID()}${mimeExtensions[file.type]}`;
    await mkdir(privateDirectory, { recursive: true });
    savedPath = path.join(privateDirectory, storageName);
    await writeFile(savedPath, bytes, { flag: "wx", mode: 0o600 });

    connection = await db.getConnection();
    await connection.beginTransaction();
    const [vehicles] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM vehicles WHERE id = ? AND is_deleted = 0",
      [vehicleId]
    );
    if (!vehicles[0]) {
      await connection.rollback();
      await unlink(savedPath);
      savedPath = null;
      return NextResponse.json({ message: "Vehicle not found" }, { status: 404 });
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO vehicle_documents
       (vehicle_id, document_type, original_filename, storage_name, mime_type, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [vehicleId, documentType.trim().slice(0, 80), path.basename(file.name).slice(0, 255), storageName, file.type, file.size]
    );
    await addVehicleHistory(connection, vehicleId, "document_uploaded", {
      documentId: result.insertId,
      documentType: documentType.trim(),
      filename: path.basename(file.name),
    });
    await connection.commit();
    savedPath = null;
    return NextResponse.json({ message: "Document uploaded", id: result.insertId }, { status: 201 });
  } catch (error) {
    if (connection) await connection.rollback();
    if (savedPath) await unlink(savedPath).catch(() => undefined);
    console.error("Upload vehicle document error:", error);
    return NextResponse.json({ message: "Could not upload vehicle document" }, { status: 500 });
  } finally {
    connection?.release();
  }
}