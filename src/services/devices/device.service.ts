import { db } from "@/lib/db";
import { ZKTecoAdapter } from "./zkteco-adapter";
import { MockAdapter } from "./mock-adapter";
import { AttendanceDeviceAdapter, AttendanceDeviceConfig } from "./device-adapter.interface";
import { calculateAttendanceHoursAndStatus } from "@/services/attendance.service";
import { logAuditAction } from "@/services/audit.service";
import { format } from "date-fns";

export function getDeviceAdapter(device: AttendanceDeviceConfig): AttendanceDeviceAdapter {
  if (device.isMockMode || device.deviceType === "MOCK") {
    return new MockAdapter();
  }
  return new ZKTecoAdapter();
}

export async function testDeviceConnection(deviceId: string) {
  const device = await db.attendanceDevice.findUnique({
    where: { id: deviceId },
  });

  if (!device) {
    throw new Error("Attendance device not found");
  }

  const adapter = getDeviceAdapter(device);
  const result = await adapter.testConnection(device);

  await db.attendanceDevice.update({
    where: { id: deviceId },
    data: {
      connectionStatus: result.success ? "CONNECTED" : "ERROR",
      lastSyncResult: result.message,
    },
  });

  await logAuditAction({
    action: result.success ? "DEVICE_TEST_SUCCESS" : "DEVICE_TEST_FAILED",
    entity: "AttendanceDevice",
    entityId: device.id,
    metadata: {
      deviceName: device.name,
      ip: device.ipAddress,
      isMock: result.isMock,
      resultMessage: result.message,
    },
  });

  return result;
}

export async function syncDeviceAttendance(deviceId: string) {
  const device = await db.attendanceDevice.findUnique({
    where: { id: deviceId },
  });

  if (!device) {
    throw new Error("Attendance device not found");
  }

  const syncLog = await db.attendanceSyncLog.create({
    data: {
      deviceId,
      status: "IN_PROGRESS",
      startedAt: new Date(),
    },
  });

  try {
    const adapter = getDeviceAdapter(device);
    const syncResult = await adapter.fetchPunches(device, device.lastSyncTime);

    let punchesFetched = syncResult.punches.length;
    let punchesProcessed = 0;

    // 1. Stage punches into raw ledger with deterministic deduplication
    for (const p of syncResult.punches) {
      const eventKey = `${device.id}_${p.deviceUserId}_${p.punchTime.toISOString()}`;

      await db.attendancePunchRaw.upsert({
        where: { eventKey },
        create: {
          deviceId: device.id,
          deviceUserId: p.deviceUserId,
          punchTime: p.punchTime,
          punchType: p.punchType || "UNKNOWN",
          verifyType: p.verifyType || "FINGERPRINT",
          eventKey,
          rawPayload: p.rawPayload,
          isProcessed: false,
        },
        update: {},
      });
    }

    // 2. Fetch employee mappings for this device
    const mappings = await db.attendanceDeviceMapping.findMany({
      where: { deviceId: device.id },
      include: { employee: { include: { shift: true } } },
    });

    const userToEmpMap = new Map(
      mappings.filter((m) => m.employeeId).map((m) => [m.deviceUserId, m.employee!])
    );

    // 3. Fetch all unprocessed punches for this device
    const pendingPunches = await db.attendancePunchRaw.findMany({
      where: { deviceId: device.id, isProcessed: false },
      orderBy: { punchTime: "asc" },
    });

    // Group punches by employee and date (YYYY-MM-DD)
    const groupedPunches = new Map<string, typeof pendingPunches>();

    for (const punch of pendingPunches) {
      const employee = userToEmpMap.get(punch.deviceUserId);
      if (!employee) continue; // Unmapped user, remains unprocessed for manual mapping

      const dateStr = format(punch.punchTime, "yyyy-MM-dd");
      const key = `${employee.id}_${dateStr}`;

      const list = groupedPunches.get(key) || [];
      list.push(punch);
      groupedPunches.set(key, list);
    }

    // 4. Transform grouped punches into normalized AttendanceRecords
    const processedPunchIds: string[] = [];

    for (const [key, punchGroup] of Array.from(groupedPunches.entries())) {
      const [employeeId, dateStr] = key.split("_");
      const employee = userToEmpMap.get(punchGroup[0].deviceUserId)!;
      const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

      const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

      // Query all existing punches for that employee on that date across the device
      const allDayPunches = await db.attendancePunchRaw.findMany({
        where: {
          deviceId: device.id,
          deviceUserId: punchGroup[0].deviceUserId,
          punchTime: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
        orderBy: { punchTime: "asc" },
      });

      // Also read any existing AttendanceRecord to preserve earlier check-ins or manual adjustments
      const existingRecord = await db.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: targetDate,
          },
        },
      });

      // Determine earliest punch / check-in across raw punches and existing record
      const earliestRaw = allDayPunches.length > 0 ? allDayPunches[0].punchTime : null;
      let earliestCheckIn: Date | null = earliestRaw;

      if (existingRecord?.checkIn) {
        if (!earliestCheckIn || existingRecord.checkIn < earliestCheckIn) {
          earliestCheckIn = existingRecord.checkIn;
        }
      }

      // Determine latest punch / check-out across raw punches and existing record
      const latestRaw = allDayPunches.length > 1 ? allDayPunches[allDayPunches.length - 1].punchTime : null;
      let latestCheckOut: Date | null = latestRaw;

      // If only 1 punch exists in raw punches, but an earlier check-in already existed,
      // that single raw punch is an afternoon/evening check-out!
      if (allDayPunches.length === 1 && existingRecord?.checkIn) {
        if (allDayPunches[0].punchTime > existingRecord.checkIn) {
          latestCheckOut = allDayPunches[0].punchTime;
        }
      }

      if (existingRecord?.checkOut) {
        if (!latestCheckOut || existingRecord.checkOut > latestCheckOut) {
          latestCheckOut = existingRecord.checkOut;
        }
      }

      // Guard: if latestCheckOut is not later than earliestCheckIn, checkOut is null
      if (earliestCheckIn && latestCheckOut && latestCheckOut.getTime() <= earliestCheckIn.getTime()) {
        latestCheckOut = null;
      }

      const formatHHmm = (d: Date) => format(d, "HH:mm");

      const checkInTimeStr = earliestCheckIn ? formatHHmm(earliestCheckIn) : null;
      const checkOutTimeStr = latestCheckOut ? formatHHmm(latestCheckOut) : null;

      const calc = calculateAttendanceHoursAndStatus({
        dateStr,
        checkInTime: checkInTimeStr,
        checkOutTime: checkOutTimeStr,
        shift: employee.shift,
      });

      await db.attendanceRecord.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: targetDate,
          },
        },
        create: {
          employeeId: employee.id,
          shiftId: employee.shiftId,
          date: targetDate,
          checkIn: calc.checkIn,
          checkOut: calc.checkOut,
          status: calc.status,
          regularHours: calc.regularHours,
          overtimeHours: calc.overtimeHours,
          source: "ZKTECO",
          remarks: `Synced from device: ${device.name}`,
        },
        update: {
          checkIn: calc.checkIn,
          checkOut: calc.checkOut,
          status: calc.status,
          regularHours: calc.regularHours,
          overtimeHours: calc.overtimeHours,
          source: "ZKTECO",
          remarks: `Synced from device: ${device.name}`,
        },
      });

      punchGroup.forEach((p) => processedPunchIds.push(p.id));
      punchesProcessed += punchGroup.length;
    }

    // Mark processed punches
    if (processedPunchIds.length > 0) {
      await db.attendancePunchRaw.updateMany({
        where: { id: { in: processedPunchIds } },
        data: { isProcessed: true, processedAt: new Date() },
      });
    }

    // Update Device metadata
    await db.attendanceDevice.update({
      where: { id: deviceId },
      data: {
        connectionStatus: "CONNECTED",
        lastSyncTime: new Date(),
        lastSyncResult: `Sync success: ${punchesFetched} fetched, ${punchesProcessed} processed into attendance ledger.`,
        lastSyncCount: { increment: punchesProcessed },
      },
    });

    // Complete Sync Log
    await db.attendanceSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "SUCCESS",
        punchesFetched,
        punchesProcessed,
        completedAt: new Date(),
      },
    });

    await logAuditAction({
      action: "ZKTECO_SYNC_SUCCESS",
      entity: "AttendanceDevice",
      entityId: device.id,
      metadata: {
        deviceName: device.name,
        punchesFetched,
        punchesProcessed,
      },
    });

    return {
      success: true,
      punchesFetched,
      punchesProcessed,
      message: `Successfully synchronized ${punchesProcessed} biometric attendance records.`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Sync error";

    await db.attendanceDevice.update({
      where: { id: deviceId },
      data: {
        connectionStatus: "ERROR",
        lastSyncResult: `Failed: ${errorMsg}`,
        failedSyncCount: { increment: 1 },
      },
    });

    await db.attendanceSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILURE",
        errorMessage: errorMsg,
        completedAt: new Date(),
      },
    });

    await logAuditAction({
      action: "ZKTECO_SYNC_FAILURE",
      entity: "AttendanceDevice",
      entityId: device.id,
      metadata: { error: errorMsg },
    });

    throw err;
  }
}