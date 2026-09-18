import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";

export const metadata: Metadata = {
  title: "Factory Workforce V0.1",
  description: "Minimal HR, Attendance, and Payroll Prototype for Garment Manufacturing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-slate-50 antialiased font-sans text-slate-900">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <div className="p-8 max-w-7xl w-full mx-auto">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
