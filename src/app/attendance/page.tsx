import { db } from "@/lib/db";
import { AttendanceSheet } from "@/components/attendance/attendance-sheet";
import { AttendanceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams?: { date?: string };
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const dateStr = searchParams?.date || todayStr;
  const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

  // 1. Fetch active employees with shift details
  const employees = await db.employee.findMany({
    where: { status: "ACTIVE" },
    orderBy: { employeeCode: "asc" },
    include: {
      shift: true,
    },
  });

  // 2. Fetch existing attendance records for the target date
  const existingRecords = await db.attendanceRecord.findMany({
    where: { date: targetDate },
  });

  const recordMap = new Map(existingRecords.map((r) => [r.employeeId, r]));

  // 3. Format initial rows
  const initialRows = employees.map((emp) => {
    const rec = recordMap.get(emp.id);

    function formatTime(d: Date | null | undefined): string {
      if (!d) return "";
      const dateObj = new Date(d);
      const hours = String(dateObj.getUTCHours()).padStart(2, "0");
      const mins = String(dateObj.getUTCMinutes()).padStart(2, "0");
      return `${hours}:${mins}`;
    }

    const shiftData = emp.shift
      ? {
          id: emp.shift.id,
          name: emp.shift.name,
          startTime: emp.shift.startTime,
          endTime: emp.shift.endTime,
          breakMinutes: emp.shift.breakMinutes,
          standardHours: Number(emp.shift.standardHours),
          gracePeriodMinutes: emp.shift.gracePeriodMinutes,
        }
      : null;

    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department,
      shift: shiftData,
      status: rec ? rec.status : AttendanceStatus.PRESENT,
      checkInTime: rec?.checkIn ? formatTime(rec.checkIn) : emp.shift?.startTime || "",
      checkOutTime: rec?.checkOut ? formatTime(rec.checkOut) : emp.shift?.endTime || "",
      regularHours: rec ? Number(rec.regularHours) : emp.shift ? Number(emp.shift.standardHours) : 8.0,
      overtimeHours: rec ? Number(rec.overtimeHours) : 0,
      remarks: rec?.remarks || "",
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Daily Attendance Ledger
        </h2>
        <p className="text-sm text-slate-500">
          Bulk timecard entry for factory floor workers. Automatically evaluates late grace periods and calculates overtime.
        </p>
      </div>

      <AttendanceSheet dateStr={dateStr} initialRows={initialRows} />
    </div>
  );
}