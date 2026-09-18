"use server";

import { db } from "@/lib/db";
import { calculateMonthlyPayroll } from "@/services/payroll.service";
import { PayrollStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function generateAndSavePayroll(year: number, month: number, status: PayrollStatus = PayrollStatus.DRAFT) {
  try {
    const calculations = await calculateMonthlyPayroll(year, month);

    const operations = calculations.map((calc) =>
      db.payrollSummary.upsert({
        where: {
          employeeId_year_month: {
            employeeId: calc.employeeId,
            year,
            month,
          },
        },
        create: {
          employeeId: calc.employeeId,
          year,
          month,
          totalWorkingDays: calc.totalWorkingDays,
          presentDays: calc.presentDays,
          absentDays: calc.absentDays,
          totalRegularHours: calc.totalRegularHours,
          totalOvertimeHours: calc.totalOvertimeHours,
          basePay: calc.baseSalary,
          overtimePay: calc.overtimePay,
          deductions: calc.deductions,
          netPay: calc.netPay,
          status,
        },
        update: {
          totalWorkingDays: calc.totalWorkingDays,
          presentDays: calc.presentDays,
          absentDays: calc.absentDays,
          totalRegularHours: calc.totalRegularHours,
          totalOvertimeHours: calc.totalOvertimeHours,
          basePay: calc.baseSalary,
          overtimePay: calc.overtimePay,
          deductions: calc.deductions,
          netPay: calc.netPay,
          status,
        },
      })
    );

    await db.$transaction(operations);

    revalidatePath("/payroll");
    revalidatePath("/dashboard");

    return { success: true, count: operations.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate payroll snapshot";
    return { success: false, error: message };
  }
}