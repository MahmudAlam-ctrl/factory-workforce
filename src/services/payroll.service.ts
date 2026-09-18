import { db } from "@/lib/db";
import { AttendanceStatus, PayrollStatus } from "@prisma/client";

export interface EmployeePayrollCalculation {
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string;
  designation: string;
  month: number;
  year: number;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  lateDays: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  baseSalary: number;
  hourlyRate: number;
  overtimePay: number;
  deductions: number;
  netPay: number;
  status: PayrollStatus;
}

export async function calculateMonthlyPayroll(
  year: number,
  month: number
): Promise<EmployeePayrollCalculation[]> {
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  // 1. Fetch active employees
  const employees = await db.employee.findMany({
    where: { status: "ACTIVE" },
    orderBy: { employeeCode: "asc" },
  });

  // 2. Fetch all attendance records in range
  const attendanceRecords = await db.attendanceRecord.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Group records by employeeId
  const attendanceByEmp = new Map<string, typeof attendanceRecords>();
  for (const rec of attendanceRecords) {
    const list = attendanceByEmp.get(rec.employeeId) || [];
    list.push(rec);
    attendanceByEmp.set(rec.employeeId, list);
  }

  // 3. Fetch any existing locked/draft payroll summaries
  const existingSummaries = await db.payrollSummary.findMany({
    where: { year, month },
  });
  const summaryMap = new Map(existingSummaries.map((s) => [s.employeeId, s]));

  const totalWorkingDays = 26; // Standard industrial factory working days

  return employees.map((emp) => {
    const records = attendanceByEmp.get(emp.id) || [];
    const existing = summaryMap.get(emp.id);

    let presentDays = 0;
    let lateDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let totalRegularHours = 0;
    let totalOvertimeHours = 0;

    for (const r of records) {
      if (r.status === AttendanceStatus.PRESENT) {
        presentDays++;
      } else if (r.status === AttendanceStatus.LATE) {
        lateDays++;
        presentDays++; // Late arrivals still count as present
      } else if (r.status === AttendanceStatus.HALF_DAY) {
        halfDays++;
      } else if (r.status === AttendanceStatus.ABSENT) {
        absentDays++;
      }

      totalRegularHours += Number(r.regularHours || 0);
      totalOvertimeHours += Number(r.overtimeHours || 0);
    }

    const baseSalary = Number(emp.baseSalary);
    const hourlyRate = Number(emp.hourlyRate);

    // Overtime pay: OT Hours * Hourly Rate * 2.0 (approved standard)
    const overtimePay = Math.round(totalOvertimeHours * hourlyRate * 2.0 * 100) / 100;

    // Deductions for unexcused absent days and half days
    const dailyRate = baseSalary / totalWorkingDays;
    const deductions = Math.round((absentDays * dailyRate + halfDays * (dailyRate / 2)) * 100) / 100;

    // Net pay: Base + OT - Deductions
    const netPay = Math.max(0, Math.round((baseSalary + overtimePay - deductions) * 100) / 100);

    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department,
      designation: emp.designation,
      month,
      year,
      totalWorkingDays,
      presentDays,
      absentDays,
      halfDays,
      lateDays,
      totalRegularHours: Math.round(totalRegularHours * 100) / 100,
      totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
      baseSalary,
      hourlyRate,
      overtimePay,
      deductions,
      netPay,
      status: existing ? existing.status : PayrollStatus.DRAFT,
    };
  });
}