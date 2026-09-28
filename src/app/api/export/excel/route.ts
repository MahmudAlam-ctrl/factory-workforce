import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateMonthlyPayroll } from "@/services/payroll.service";
import {
  generateEmployeesExcel,
  generateAttendanceExcel,
  generatePayrollExcel,
} from "@/services/export-excel.service";
import { logAuditAction } from "@/services/audit.service";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "employees" | "attendance" | "payroll"
    const todayStr = format(new Date(), "yyyy-MM-dd");

    if (type === "employees") {
      const employees = await db.employee.findMany({
        orderBy: { employeeCode: "asc" },
        include: { shift: true },
      });

      const buffer = await generateEmployeesExcel(employees);

      await logAuditAction({
        action: "EXPORT_EXCEL",
        entity: "Employee",
        metadata: { recordCount: employees.length },
      });

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="employees_${todayStr}.xlsx"`,
        },
      });
    }

    if (type === "attendance") {
      const dateStr = searchParams.get("date") || todayStr;
      const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

      const records = await db.attendanceRecord.findMany({
        where: { date: targetDate },
        include: { employee: true, shift: true },
        orderBy: { employee: { employeeCode: "asc" } },
      });

      const buffer = await generateAttendanceExcel(records, dateStr);

      await logAuditAction({
        action: "EXPORT_EXCEL",
        entity: "AttendanceRecord",
        metadata: { date: dateStr, recordCount: records.length },
      });

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="attendance_${dateStr}.xlsx"`,
        },
      });
    }

    if (type === "payroll") {
      const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : new Date().getFullYear();
      const month = searchParams.get("month") ? parseInt(searchParams.get("month")!, 10) : new Date().getMonth() + 1;

      const payrollItems = await calculateMonthlyPayroll(year, month);
      const buffer = await generatePayrollExcel(payrollItems, year, month);

      await logAuditAction({
        action: "EXPORT_EXCEL",
        entity: "PayrollSummary",
        metadata: { year, month, recordCount: payrollItems.length },
      });

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="payroll_${year}-${String(month).padStart(2, "0")}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
  } catch (err: unknown) {
    console.error("Excel export error:", err);
    return NextResponse.json({ error: "Failed to generate Excel export" }, { status: 500 });
  }
}