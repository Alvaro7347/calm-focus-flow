import type { ReactNode } from "react";
import { LogoSymbol } from "@/components/brand/LogoSymbol";
import { BRAND } from "@/brand/brand";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white flex flex-col">
      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center mb-8">
            <LogoSymbol size={56} opacity={0.95} ariaHidden />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">{subtitle}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            {children}
          </div>

          {footer ? (
            <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>
          ) : null}

          <p className="mt-10 text-center text-[11px] uppercase tracking-widest text-slate-400">
            {BRAND.name}
          </p>
        </div>
      </main>
    </div>
  );
}
