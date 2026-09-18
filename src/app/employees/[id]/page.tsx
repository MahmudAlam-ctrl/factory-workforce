import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { EmployeeForm } from "@/components/employees/employee-form";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({
  params,
}: {
  params: { id: string };
}) {
  const [employee, shifts] = await Promise.all([
    db.employee.findUnique({
      where: { id: params.id },
    }),
    db.shift.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        startTime: true,
        endTime: true,
        isDefault: true,
      },
    }),
  ]);

  if (!employee) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Edit Worker Profile: {employee.firstName} {employee.lastName}
        </h2>
        <p className="text-sm text-slate-500 font-mono">
          {employee.employeeCode} &bull; {employee.department} &bull; {employee.designation}
        </p>
      </div>

      <EmployeeForm
        initialData={{
          id: employee.id,
          employeeCode: employee.employeeCode,
          firstName: employee.firstName,
          lastName: employee.lastName,
          department: employee.department,
          designation: employee.designation,
          joiningDate: employee.joiningDate,
          baseSalary: employee.baseSalary,
          hourlyRate: employee.hourlyRate,
          shiftId: employee.shiftId,
          status: employee.status,
        }}
        shifts={shifts}
      />
    </div>
  );
}