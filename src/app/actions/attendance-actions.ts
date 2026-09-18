"use server";

import { db } from "@/lib/db";
import { calculateAttendanceHoursAndStatus } from "@/services/attendance.service";
import { AttendanceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const AttendanceItemSchema = z.object({
  employeeId: z.string().min(1),
  shiftId: z.string().nullable().optional(),
  status: z.nativeEnum(AttendanceStatus),
  checkInTime: z.string().optional().nullable(),
  checkOutTime: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

const BulkAttendanceSchema = z.object({
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  records: z.array(AttendanceItemSchema),
});

export async function saveBulkAttendance(data: {
  dateStr: string;
  records: Array<{
    employeeId: string;
    shiftId?: string | null;
    status: AttendanceStatus;
    checkInTime?: string | null;
    checkOutTime?: string | null;
    remarks?: string | null;
  }>;
}) {
  try {
    const parsed = BulkAttendanceSchema.parse(data);
    const dateObj = new Date(`${parsed.dateStr}T00:00:00.000Z`);

    // Fetch shift data for accurate math
    const shifts = await db.shift.findMany();
    const shiftMap = new Map(shifts.map((s) => [s.id, s]));

    const upsertOperations = parsed.records.map((rec) => {
      const shift = rec.shiftId ? shiftMap.get(rec.shiftId) ?? null : null;

      const calc = calculateAttendanceHoursAndStatus({
        dateStr: parsed.dateStr,
        checkInTime: rec.checkInTime,
        checkOutTime: rec.checkOutTime,
        shift,
        manualStatus: rec.status,
      });

      return db.attendanceRecord.upsert({
        where: {
          employeeId_date: {
            employeeId: rec.employeeId,
            date: dateObj,
          },
        },
        create: {
          employeeId: rec.employeeId,
          shiftId: rec.shiftId || null,
          date: dateObj,
          checkIn: calc.checkIn,
          checkOut: calc.checkOut,
          status: calc.status,
          regularHours: calc.regularHours,
          overtimeHours: calc.overtimeHours,
          remarks: rec.remarks || null,
        },
        update: {
          shiftId: rec.shiftId || null,
          checkIn: calc.checkIn,
          checkOut: calc.checkOut,
          status: calc.status,
          regularHours: calc.regularHours,
          overtimeHours: calc.overtimeHours,
          remarks: rec.remarks || null,
        },
      });
    });

    await db.$transaction(upsertOperations);

    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    revalidatePath("/payroll");

    return { success: true, count: upsertOperations.length };
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.errors[0]?.message ?? "Validation failed" };
    }
    const message = err instanceof Error ? err.message : "Failed to save attendance";
    return { success: false, error: message };
  }
}