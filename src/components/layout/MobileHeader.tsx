import { Menu } from "lucide-react";

interface Props {
  onOpenDrawer: () => void;
}

export function MobileHeader({ onOpenDrawer }: Props) {
  return (
    <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-slate-100 bg-white px-4 h-14">
      <button
        onClick={onOpenDrawer}
        aria-label="Abrir menú de áreas"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-50"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="font-bold text-slate-900">CalmApp</div>
    </header>
  );
}
