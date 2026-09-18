export type Department =
  | "Cutting"
  | "Sewing"
  | "Finishing"
  | "Quality"
  | "Maintenance"
  | "Admin";

export const DEPARTMENTS: Department[] = [
  "Cutting",
  "Sewing",
  "Finishing",
  "Quality",
  "Maintenance",
  "Admin",
];

export const DESIGNATIONS = [
  "Sewing Machine Operator",
  "Junior Operator",
  "Cutting Master",
  "Cutting Helper",
  "Finishing Helper",
  "Iron Operator",
  "Quality Inspector",
  "Line Supervisor",
  "Floor In-Charge",
  "Maintenance Technician",
] as const;

export type Designation = (typeof DESIGNATIONS)[number];

export interface ShiftInput {
  name: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  breakMinutes: number;
  standardHours: number;
  gracePeriodMinutes: number;
  isDefault?: boolean;
}

export interface EmployeeInput {
  employeeCode: string;
  firstName: string;
  lastName: string;
  department: string;
  designation: string;
  joiningDate: string;
  baseSalary: number;
  hourlyRate: number;
  shiftId?: string | null;
}

export interface AttendanceEntryInput {
  employeeId: string;
  date: string; // YYYY-MM-DD
  checkIn?: string | null; // ISO string or HH:mm
  checkOut?: string | null;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY";
  remarks?: string;
}

export interface PayrollFilterInput {
  month: number;
  year: number;
}
