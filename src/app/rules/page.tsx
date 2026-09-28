import { getActivePayrollRule, getPayrollRuleHistory } from "@/services/rules.service";
import { RulesForm } from "@/components/rules/rules-form";
import { Sliders } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PayrollRulesPage() {
  const currentRule = await getActivePayrollRule();
  const history = await getPayrollRuleHistory();

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
          <Sliders className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Payroll &amp; Overtime Rules Configuration
          </h2>
          <p className="text-sm text-slate-500">
            Define statutory overtime multipliers (1.5x), daily working thresholds, grace tolerance, and standard working day metrics.
          </p>
        </div>
      </div>

      <RulesForm currentRule={currentRule} history={history} />
    </div>
  );
}