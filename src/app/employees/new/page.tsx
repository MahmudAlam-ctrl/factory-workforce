import { db } from "@/lib/db";
import { EmployeeForm } from "@/components/employees/employee-form";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const shifts = await db.shift.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
      isDefault: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Register New Factory Worker
        </h2>
        <p className="text-sm text-slate-500">
          Add an operator, technician, or line supervisor to the active payroll and shift roster.
        </p>
      </div>

      <EmployeeForm shifts={shifts} />
    </div>
  );
}