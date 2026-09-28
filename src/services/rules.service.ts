import { db } from "@/lib/db";
import { logAuditAction } from "@/services/audit.service";

export interface PayrollRuleData {
  id?: string;
  overtimeMultiplier: number;
  standardDailyHours: number;
  standardWorkingDays: number;
  gracePeriodMinutes: number;
  breakDurationMinutes: number;
  currency: string;
  currencySymbol: string;
  effectiveFrom: Date;
  isActive: boolean;
  remarks?: string | null;
}

export async function getActivePayrollRule(): Promise<PayrollRuleData> {
  const active = await db.payrollRule.findFirst({
    where: { isActive: true },
    orderBy: { effectiveFrom: "desc" },
  });

  if (active) {
    return {
      id: active.id,
      overtimeMultiplier: Number(active.overtimeMultiplier),
      standardDailyHours: Number(active.standardDailyHours),
      standardWorkingDays: active.standardWorkingDays,
      gracePeriodMinutes: active.gracePeriodMinutes,
      breakDurationMinutes: active.breakDurationMinutes,
      currency: active.currency,
      currencySymbol: active.currencySymbol,
      effectiveFrom: active.effectiveFrom,
      isActive: active.isActive,
      remarks: active.remarks,
    };
  }

  // Create standard 1.5x statutory rule if missing
  const created = await db.payrollRule.create({
    data: {
      overtimeMultiplier: 1.5,
      standardDailyHours: 8.0,
      standardWorkingDays: 26,
      gracePeriodMinutes: 15,
      breakDurationMinutes: 60,
      currency: "BDT",
      currencySymbol: "৳",
      isActive: true,
      effectiveFrom: new Date(),
      remarks: "Standard Factory Workforce Rule (1.5x Overtime)",
    },
  });

  return {
    id: created.id,
    overtimeMultiplier: Number(created.overtimeMultiplier),
    standardDailyHours: Number(created.standardDailyHours),
    standardWorkingDays: created.standardWorkingDays,
    gracePeriodMinutes: created.gracePeriodMinutes,
    breakDurationMinutes: created.breakDurationMinutes,
    currency: created.currency,
    currencySymbol: created.currencySymbol,
    effectiveFrom: created.effectiveFrom,
    isActive: created.isActive,
    remarks: created.remarks,
  };
}

export async function updatePayrollRule(data: {
  overtimeMultiplier: number;
  standardDailyHours: number;
  standardWorkingDays: number;
  gracePeriodMinutes: number;
  breakDurationMinutes: number;
  currency: string;
  currencySymbol: string;
  remarks?: string | null;
}) {
  const prevRule = await getActivePayrollRule();

  // Deactivate previous rules
  await db.payrollRule.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  // Create new active rule
  const newRule = await db.payrollRule.create({
    data: {
      overtimeMultiplier: data.overtimeMultiplier,
      standardDailyHours: data.standardDailyHours,
      standardWorkingDays: data.standardWorkingDays,
      gracePeriodMinutes: data.gracePeriodMinutes,
      breakDurationMinutes: data.breakDurationMinutes,
      currency: data.currency,
      currencySymbol: data.currencySymbol,
      effectiveFrom: new Date(),
      isActive: true,
      remarks: data.remarks || null,
    },
  });

  await logAuditAction({
    action: "PAYROLL_RULE_UPDATE",
    entity: "PayrollRule",
    entityId: newRule.id,
    metadata: {
      previous: prevRule,
      updated: data,
    },
  });

  return newRule;
}

export async function getPayrollRuleHistory() {
  const rules = await db.payrollRule.findMany({
    orderBy: { createdAt: "desc" },
  });

  return rules.map((r) => ({
    id: r.id,
    overtimeMultiplier: Number(r.overtimeMultiplier),
    standardDailyHours: Number(r.standardDailyHours),
    standardWorkingDays: r.standardWorkingDays,
    gracePeriodMinutes: r.gracePeriodMinutes,
    breakDurationMinutes: r.breakDurationMinutes,
    currency: r.currency,
    currencySymbol: r.currencySymbol,
    effectiveFrom: r.effectiveFrom,
    isActive: r.isActive,
    remarks: r.remarks,
    createdAt: r.createdAt,
  }));
}