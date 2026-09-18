import { db } from "@/lib/db";
import { CreateShiftModal } from "@/components/shifts/create-shift-modal";
import { ShiftList } from "@/components/shifts/shift-list";

export const dynamic = "force-dynamic";

export default async function ShiftsPage() {
  const shifts = await db.shift.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: { employees: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Shift Schedules
          </h2>
          <p className="text-sm text-slate-500">
            Define factory production shifts, daily standard working hours, and grace arrival times.
          </p>
        </div>
        <CreateShiftModal />
      </div>

      <ShiftList shifts={shifts} />
    </div>
  );
}