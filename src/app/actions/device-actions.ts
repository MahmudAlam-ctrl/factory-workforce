"use server";

import { db } from "@/lib/db";
import { testDeviceConnection, syncDeviceAttendance } from "@/services/devices/device.service";
import { logAuditAction } from "@/services/audit.service";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const DeviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Device name is required"),
  deviceType: z.string().default("ZKTECO"),
  model: z.string().optional().nullable(),
  ipAddress: z.string().min(4, "IP address is required"),
  port: z.coerce.number().int().default(4370),
  commKey: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  timezone: z.string().default("Asia/Dhaka"),
  isEnabled: z.boolean().default(true),
  isMockMode: z.boolean().default(false),
});

export async function saveDeviceAction(formData: FormData) {
  try {
    const raw = {
      id: formData.get("id") ? String(formData.get("id")) : undefined,
      name: formData.get("name"),
      deviceType: formData.get("deviceType") || "ZKTECO",
      model: formData.get("model") || null,
      ipAddress: formData.get("ipAddress"),
      port: formData.get("port") || 4370,
      commKey: formData.get("commKey") || null,
      serialNumber: formData.get("serialNumber") || null,
      timezone: formData.get("timezone") || "Asia/Dhaka",
      isEnabled: formData.get("isEnabled") === "true",
      isMockMode: formData.get("isMockMode") === "true",
    };

    const parsed = DeviceSchema.parse(raw);

    if (parsed.id) {
      const updated = await db.attendanceDevice.update({
        where: { id: parsed.id },
        data: parsed,
      });

      await logAuditAction({
        action: "DEVICE_UPDATE",
        entity: "AttendanceDevice",
        entityId: updated.id,
        metadata: { name: updated.name, ip: updated.ipAddress },
      });
    } else {
      const created = await db.attendanceDevice.create({
        data: parsed,
      });

      // Automatically create initial default mappings for active employees
      const employees = await db.employee.findMany({ take: 10 });
      for (const emp of employees) {
        // e.g. EMP-1001 -> user ID "1001"
        const numId = emp.employeeCode.replace(/\D/g, "") || emp.employeeCode;
        await db.attendanceDeviceMapping.create({
          data: {
            deviceId: created.id,
            deviceUserId: numId,
            employeeId: emp.id,
          },
        }).catch(() => {});
      }

      await logAuditAction({
        action: "DEVICE_CREATE",
        entity: "AttendanceDevice",
        entityId: created.id,
        metadata: { name: created.name, ip: created.ipAddress },
      });
    }

    revalidatePath("/devices");
    return { success: true };
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.errors[0]?.message ?? "Validation failed" };
    }
    const message = err instanceof Error ? err.message : "Failed to save device";
    return { success: false, error: message };
  }
}

export async function testDeviceAction(deviceId: string) {
  try {
    const result = await testDeviceConnection(deviceId);
    revalidatePath("/devices");
    return { success: result.success, result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection test failed";
    return { success: false, error: message };
  }
}

export async function syncDeviceAction(deviceId: string) {
  try {
    const result = await syncDeviceAttendance(deviceId);
    revalidatePath("/devices");
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    revalidatePath("/payroll");
    return { success: true, result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Synchronization failed";
    return { success: false, error: message };
  }
}

export async function saveMappingAction(
  deviceId: string,
  mappings: Array<{ deviceUserId: string; employeeId: string | null }>
) {
  try {
    for (const m of mappings) {
      await db.attendanceDeviceMapping.upsert({
        where: {
          deviceId_deviceUserId: {
            deviceId,
            deviceUserId: m.deviceUserId,
          },
        },
        create: {
          deviceId,
          deviceUserId: m.deviceUserId,
          employeeId: m.employeeId || null,
        },
        update: {
          employeeId: m.employeeId || null,
        },
      });
    }

    revalidatePath("/devices");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save mapping";
    return { success: false, error: message };
  }
}