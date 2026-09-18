import { calculateMonthlyPayroll } from "@/services/payroll.service";
import { PayrollTable } from "@/components/payroll/payroll-table";

export const dynamic = "force-dynamic";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams?: { year?: string; month?: string };
}) {
  const currentDate = new Date();
  const year = searchParams?.year ? parseInt(searchParams.year, 10) : currentDate.getFullYear();
  const month = searchParams?.month ? parseInt(searchParams.month, 10) : currentDate.getMonth() + 1;

  const calculations = await calculateMonthlyPayroll(year, month);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Monthly Payroll Summary
        </h2>
        <p className="text-sm text-slate-500">
          Automated wage disbursement calculation based on daily attendance, overtime (2.0x RMG multiplier), and unexcused absence deductions.
        </p>
      </div>

      <PayrollTable year={year} month={month} rows={calculations} />
    </div>
  );
}