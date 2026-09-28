import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateMonthlyPayroll } from "@/services/payroll.service";
import {
  generateEmployeesPdf,
  generateAttendancePdf,
  generatePayrollPdf,
  generateIndividualPaySlipPdf,
} from "@/services/export-pdf.service";
import { logAuditAction } from "@/services/audit.service";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "employees" | "attendance" | "payroll" | "slip"
    const todayStr = format(new Date(), "yyyy-MM-dd");

    if (type === "employees") {
      const employees = await db.employee.findMany({
        orderBy: { employeeCode: "asc" },
        include: { shift: true },
      });

      const buffer = await generateEmployeesPdf(employees);

      await logAuditAction({
        action: "EXPORT_PDF",
        entity: "Employee",
        metadata: { recordCount: employees.length },
      });

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="employees_${todayStr}.pdf"`,
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

      const buffer = await generateAttendancePdf(records, dateStr);

      await logAuditAction({
        action: "EXPORT_PDF",
        entity: "AttendanceRecord",
        metadata: { date: dateStr, recordCount: records.length },
      });

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="attendance_${dateStr}.pdf"`,
        },
      });
    }

    if (type === "payroll") {
      const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : new Date().getFullYear();
      const month = searchParams.get("month") ? parseInt(searchParams.get("month")!, 10) : new Date().getMonth() + 1;

      const payrollItems = await calculateMonthlyPayroll(year, month);
      const buffer = await generatePayrollPdf(payrollItems, year, month);

      await logAuditAction({
        action: "EXPORT_PDF",
        entity: "PayrollSummary",
        metadata: { year, month, recordCount: payrollItems.length },
      });

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="payroll_${year}-${String(month).padStart(2, "0")}.pdf"`,
        },
      });
    }

    if (type === "slip") {
      const employeeId = searchParams.get("employeeId");
      const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : new Date().getFullYear();
      const month = searchParams.get("month") ? parseInt(searchParams.get("month")!, 10) : new Date().getMonth() + 1;

      if (!employeeId) {
        return NextResponse.json({ error: "Missing employeeId for pay slip" }, { status: 400 });
      }

      const payrollItems = await calculateMonthlyPayroll(year, month);
      const item = payrollItems.find((p) => p.employeeId === employeeId);

      if (!item) {
        return NextResponse.json({ error: "Worker not found in period" }, { status: 404 });
      }

      const buffer = await generateIndividualPaySlipPdf(item, year, month);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="payslip_${item.employeeCode}_${year}_${month}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
  } catch (err: unknown) {
    console.error("PDF export error:", err);
    return NextResponse.json({ error: "Failed to generate PDF export" }, { status: 500 });
  }
}