"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ShiftSchema = z.object({
  name: z.string().min(2, "Shift name must be at least 2 characters"),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format must be HH:mm (24h)"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format must be HH:mm (24h)"),
  breakMinutes: z.coerce.number().int().min(0).max(180).default(60),
  standardHours: z.coerce.number().min(1).max(24).default(8.0),
  gracePeriodMinutes: z.coerce.number().int().min(0).max(60).default(15),
  isDefault: z.coerce.boolean().default(false),
});

export async function createShift(formData: FormData) {
  try {
    const rawData = {
      name: formData.get("name"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
      breakMinutes: formData.get("breakMinutes"),
      standardHours: formData.get("standardHours"),
      gracePeriodMinutes: formData.get("gracePeriodMinutes"),
      isDefault: formData.get("isDefault") === "on" || formData.get("isDefault") === "true",
    };

    const parsed = ShiftSchema.parse(rawData);

    if (parsed.isDefault) {
      // Unset previous defaults
      await db.shift.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    await db.shift.create({
      data: {
        name: parsed.name,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        breakMinutes: parsed.breakMinutes,
        standardHours: parsed.standardHours,
        gracePeriodMinutes: parsed.gracePeriodMinutes,
        isDefault: parsed.isDefault,
      },
    });

    revalidatePath("/shifts");
    return { success: true };
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.errors[0]?.message ?? "Validation failed" };
    }
    const message = err instanceof Error ? err.message : "Failed to create shift";
    return { success: false, error: message };
  }
}

export async function deleteShift(id: string) {
  try {
    const employeeCount = await db.employee.count({
      where: { shiftId: id },
    });

    if (employeeCount > 0) {
      return {
        success: false,
        error: `Cannot delete shift: ${employeeCount} employee(s) are assigned to it.`,
      };
    }

    await db.shift.delete({ where: { id } });
    revalidatePath("/shifts");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete shift";
    return { success: false, error: message };
  }
}