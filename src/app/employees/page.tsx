import { db } from "@/lib/db";
import { EmployeeTable } from "@/components/employees/employee-table";
import { DEPARTMENTS } from "@/types";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const employees = await db.employee.findMany({
    orderBy: { employeeCode: "asc" },
    include: {
      shift: {
        select: {
          id: true,
          name: true,
          startTime: true,
          endTime: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Factory Workforce Directory
        </h2>
        <p className="text-sm text-slate-500">
          Manage garment operators, helpers, supervisors, base compensation, and assigned shifts.
        </p>
      </div>

      <EmployeeTable
        employees={JSON.parse(JSON.stringify(employees))}
        departments={DEPARTMENTS}
      />
    </div>
  );
}