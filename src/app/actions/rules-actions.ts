"use server";

import { updatePayrollRule } from "@/services/rules.service";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const RuleSchema = z.object({
  overtimeMultiplier: z.coerce.number().positive("Overtime multiplier must be greater than 0"),
  standardDailyHours: z.coerce.number().positive("Standard hours must be greater than 0"),
  standardWorkingDays: z.coerce.number().int().min(1).max(31, "Working days must be between 1 and 31"),
  gracePeriodMinutes: z.coerce.number().int().min(0, "Grace period cannot be negative"),
  breakDurationMinutes: z.coerce.number().int().min(0, "Break duration cannot be negative"),
  currency: z.string().min(1, "Currency code is required"),
  currencySymbol: z.string().min(1, "Currency symbol is required"),
  remarks: z.string().optional().nullable(),
});

export async function savePayrollRuleAction(formData: FormData) {
  try {
    const raw = {
      overtimeMultiplier: formData.get("overtimeMultiplier"),
      standardDailyHours: formData.get("standardDailyHours"),
      standardWorkingDays: formData.get("standardWorkingDays"),
      gracePeriodMinutes: formData.get("gracePeriodMinutes"),
      breakDurationMinutes: formData.get("breakDurationMinutes"),
      currency: formData.get("currency"),
      currencySymbol: formData.get("currencySymbol"),
      remarks: formData.get("remarks"),
    };

    const parsed = RuleSchema.parse(raw);
    const newRule = await updatePayrollRule(parsed);

    revalidatePath("/rules");
    revalidatePath("/payroll");
    revalidatePath("/dashboard");

    return { success: true, ruleId: newRule.id };
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.errors[0]?.message ?? "Validation failed" };
    }
    const message = err instanceof Error ? err.message : "Failed to update payroll rules";
    return { success: false, error: message };
  }
}