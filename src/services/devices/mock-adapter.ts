import {
  AttendanceDeviceAdapter,
  AttendanceDeviceConfig,
  ConnectionTestResult,
  SyncResult,
  RawPunchEvent,
} from "./device-adapter.interface";
import { db } from "@/lib/db";

export class MockAdapter implements AttendanceDeviceAdapter {
  async testConnection(device: AttendanceDeviceConfig): Promise<ConnectionTestResult> {
    // Simulated mock connection
    return {
      success: true,
      latencyMs: 18,
      message: `[MOCK / DEMO MODE] Virtual ZKTeco Terminal connected successfully at ${device.ipAddress}:${device.port}.`,
      isMock: true,
      deviceInfo: {
        platform: "ZKTeco ZK-iClock880 (Simulated Demo)",
        serialNumber: "ZK-DEMO-998822",
        firmwareVersion: "Ver 6.60 Nov 15 2024",
        userCount: 150,
        logCount: 2500,
      },
    };
  }

  async fetchPunches(
    device: AttendanceDeviceConfig,
    lastSyncTime?: Date | null
  ): Promise<SyncResult> {
    // Generate realistic simulated punches for mapped device users on today's date
    const mappings = await db.attendanceDeviceMapping.findMany({
      where: { deviceId: device.id },
      include: { employee: { include: { shift: true } } },
    });

    const todayStr = new Date().toISOString().split("T")[0];
    const punches: RawPunchEvent[] = [];

    for (const m of mappings) {
      if (!m.employee) continue;

      const shiftStart = m.employee.shift?.startTime || "08:00";
      const shiftEnd = m.employee.shift?.endTime || "17:00";

      // 1. Morning Check In Punch (Around shift start)
      const checkInPunch = new Date(`${todayStr}T${shiftStart}:00.000Z`);
      punches.push({
        deviceUserId: m.deviceUserId,
        punchTime: checkInPunch,
        punchType: "CHECK_IN",
        verifyType: "FINGERPRINT",
        rawPayload: JSON.stringify({ device: device.name, method: "BIOMETRIC_VERIFY" }),
      });

      // 2. Evening Check Out Punch (With 1.5h or 2h overtime)
      const [endH, endM] = shiftEnd.split(":").map(Number);
      const outH = String(endH + 1).padStart(2, "0"); // 1 hour overtime
      const checkOutPunch = new Date(`${todayStr}T${outH}:${String(endM).padStart(2, "0")}:00.000Z`);

      punches.push({
        deviceUserId: m.deviceUserId,
        punchTime: checkOutPunch,
        punchType: "CHECK_OUT",
        verifyType: "FINGERPRINT",
        rawPayload: JSON.stringify({ device: device.name, method: "BIOMETRIC_VERIFY" }),
      });
    }

    return {
      punches,
      lastSyncTime: new Date(),
      message: `[MOCK / DEMO MODE] Generated ${punches.length} simulated biometric punches for ${mappings.length} mapped workers.`,
    };
  }
}