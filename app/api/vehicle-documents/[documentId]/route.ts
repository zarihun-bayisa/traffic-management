import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

export async function GET(_request: Request, context: RouteContext<"/api/vehicle-documents/[documentId]">) {
  const { documentId: rawId } = await context.params;
  const documentId = Number(rawId);
  if (!Number.isSafeInteger(documentId) || documentId <= 0) {
    return NextResponse.json({ message: "Invalid document id" }, { status: 400 });
  }

  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT storage_name, original_filename, mime_type FROM vehicle_documents WHERE id = ?",
      [documentId]
    );
    const document = rows[0];
    if (!document) return NextResponse.json({ message: "Document not found" }, { status: 404 });

    const storageName = String(document.storage_name);
    if (path.basename(storageName) !== storageName) {
      return NextResponse.json({ message: "Invalid stored file path" }, { status: 500 });
    }
    const bytes = await readFile(path.join(process.cwd(), "private_uploads", "vehicles", storageName));
    return new Response(bytes, {
      headers: {
        "Content-Type": String(document.mime_type),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(String(document.original_filename))}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Read vehicle document error:", error);
    return NextResponse.json({ message: "Could not read vehicle document" }, { status: 500 });
  }
}