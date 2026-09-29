import { db } from "@/lib/db";
import { DeviceManager } from "@/components/devices/device-manager";
import { Cpu } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  let devices = await db.attendanceDevice.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      mappings: {
        include: { employee: true },
      },
      syncLogs: {
        orderBy: { startedAt: "desc" },
        take: 10,
      },
    },
  });

  // Seed default demonstration devices if none exist yet
  if (devices.length === 0) {
    const demoMock = await db.attendanceDevice.create({
      data: {
        name: "Main Production Floor Gate (ZK-Demo)",
        deviceType: "MOCK",
        model: "ZK-iClock880",
        ipAddress: "192.168.1.201",
        port: 4370,
        serialNumber: "ZK-DEMO-998822",
        timezone: "Asia/Dhaka",
        isMockMode: true,
        isEnabled: true,
        connectionStatus: "CONNECTED",
      },
    });

    const employees = await db.employee.findMany({ take: 6 });
    for (const emp of employees) {
      const numId = emp.employeeCode.replace(/\D/g, "") || "1001";
      await db.attendanceDeviceMapping.create({
        data: {
          deviceId: demoMock.id,
          deviceUserId: numId,
          employeeId: emp.id,
        },
      }).catch(() => {});
    }

    devices = await db.attendanceDevice.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        mappings: {
          include: { employee: true },
        },
        syncLogs: {
          orderBy: { startedAt: "desc" },
          take: 10,
        },
      },
    });
  }

  const allEmployees = await db.employee.findMany({
    where: { status: "ACTIVE" },
    orderBy: { employeeCode: "asc" },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
          <Cpu className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Attendance Biometric Devices
          </h2>
          <p className="text-sm text-slate-500">
            Configure ZKTeco biometric terminals, run real TCP connection tests, map machine user IDs to employees, and synchronize punches into the ledger.
          </p>
        </div>
      </div>

      <DeviceManager
        devices={JSON.parse(JSON.stringify(devices))}
        employees={JSON.parse(JSON.stringify(allEmployees))}
      />
    </div>
  );
}