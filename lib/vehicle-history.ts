import type { PoolConnection } from "mysql2/promise";

export async function addVehicleHistory(
  connection: PoolConnection,
  vehicleId: number,
  action: string,
  details: unknown
) {
  await connection.execute(
    "INSERT INTO vehicle_history (vehicle_id, action, details) VALUES (?, ?, ?)",
    [vehicleId, action, JSON.stringify(details)]
  );
}