export type Vehicle = {
  id: number;
  plate: string;
  owner_name: string;
  make: string;
  model: string;
  type: string;
  status: "Available" | "In Use" | "Maintenance" | "Inactive";
};