"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarCheck,
  Calculator,
  Factory,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Employees", href: "/employees", icon: Users },
  { name: "Daily Attendance", href: "/attendance", icon: CalendarCheck },
  { name: "Shifts", href: "/shifts", icon: Clock },
  { name: "Payroll Summary", href: "/payroll", icon: Calculator },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0 min-h-screen border-r border-slate-800">
      <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
        <div className="p-2 bg-indigo-600 rounded-lg text-white">
          <Factory className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-base leading-tight tracking-wide text-white">
            FactoryWorkforce
          </h1>
          <p className="text-xs text-slate-400 font-medium">Garment MVP v0.1</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
        <div className="bg-slate-800/60 rounded-md p-2.5 border border-slate-700/50">
          <p className="font-medium text-slate-300">Shift Multiplier</p>
          <p className="text-emerald-400 font-semibold mt-0.5">2.0x Standard OT</p>
        </div>
      </div>
    </aside>
  );
}
