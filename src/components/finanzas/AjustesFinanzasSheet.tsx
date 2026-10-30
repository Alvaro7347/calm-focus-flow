/**
 * ========================================================
 * AjustesFinanzasSheet — lo que se configura una vez
 *
 * Tres secciones en un panel:
 * - Fuentes de ingreso (UNAB, UTEM, ukelele…), con monto esperado
 *   al mes opcional (editable).
 * - Cargos fijos automáticos (ChatGPT, Canva…): nombre, monto, día de
 *   cobro y medio de pago. El monto se puede ajustar (cobros en dólares).
 * - Categorías de gasto.
 * Quitar algo lo archiva: deja de aparecer, su historia se mantiene.
 * ========================================================
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  archive,
  clp,
  COLORES,
  createCategory,
  createIncomeSource,
  createRecurringCharge,
  parseMonto,
  syncRecurringCharges,
  updateIncomeSource,
  updateRecurringCharge,
  type CategoryRow,
  type IncomeSourceRow,
  type PaymentMethod,
  type RecurringChargeRow,
} from "@/services/financeService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: CategoryRow[];
  fuentes: IncomeSourceRow[];
  cargos: RecurringChargeRow[];
}

export function AjustesFinanzasSheet({ open, onOpenChange, categorias, fuentes, cargos }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle>Ajustes de Finanzas</SheetTitle>
          <SheetDescription>Fuentes de ingreso, cargos fijos y categorías.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-8 pb-10">
          <FuentesEditor fuentes={fuentes} />
          <CargosEditor cargos={cargos} categorias={categorias} />
          <CategoriasEditor categorias={categorias} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function useRefrescar() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["finanzas"] });
}

function Quitar({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

// ------------------------------------------------------------

export function FuentesEditor({ fuentes }: { fuentes: IncomeSourceRow[] }) {
  const refrescar = useRefrescar();
  const [nombre, setNombre] = useState("");
  const [esperado, setEsperado] = useState("");

  const crear = useMutation({
    mutationFn: () => createIncomeSource(nombre, parseMonto(esperado) || null),
    onSuccess: async () => {
      setNombre("");
      setEsperado("");
      await refrescar();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo crear."),
  });

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Fuentes de ingreso
      </h3>
      <ul className="divide-y rounded-xl border">
        {fuentes.length === 0 ? (
          <li className="px-3 py-3 text-sm text-slate-500">Todavía no hay fuentes.</li>
        ) : (
          fuentes.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
              <Input
                aria-label={`Monto esperado de ${f.name}`}
                inputMode="numeric"
                defaultValue={f.expected_amount ? clp(f.expected_amount) : ""}
                placeholder="Esperado"
                className="h-9 w-32 text-right"
                onBlur={async (e) => {
                  const n = parseMonto(e.target.value);
                  if ((n || null) === f.expected_amount) return;
                  await updateIncomeSource(f.id, { expected_amount: n || null }).catch(() => null);
                  await refrescar();
                }}
              />
              <Quitar
                label={`Quitar ${f.name}`}
                onClick={async () => {
                  await archive("income_sources", f.id);
                  await refrescar();
                }}
              />
            </li>
          ))
        )}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (nombre.trim()) crear.mutate();
        }}
      >
        <Input
          aria-label="Nombre de la fuente"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. UNAB"
          className="flex-1"
        />
        <Input
          aria-label="Monto esperado al mes (opcional)"
          inputMode="numeric"
          value={esperado}
          onChange={(e) => {
            const n = parseMonto(e.target.value);
            setEsperado(n ? clp(n) : "");
          }}
          placeholder="Esperado"
          className="w-28"
        />
        <Button type="submit" disabled={!nombre.trim() || crear.isPending}>
          Agregar
        </Button>
      </form>
      <p className="text-xs text-slate-500">
        El monto esperado es opcional. Sirve para ver lo que falta por recibir en el mes.
      </p>
    </section>
  );
}

// ------------------------------------------------------------

export function CargosEditor({
  cargos,
  categorias,
}: {
  cargos: RecurringChargeRow[];
  categorias: CategoryRow[];
}) {
  const refrescar = useRefrescar();
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [dia, setDia] = useState("");
  const [medio, setMedio] = useState<PaymentMethod>("credito");

  const suscripciones = categorias.find((c) => c.name.toLowerCase() === "suscripciones");

  const crear = useMutation({
    mutationFn: async () => {
      const diaNum = Math.min(31, Math.max(1, Math.round(Number(dia) || 1)));
      await createRecurringCharge({
        name: nombre,
        amount: parseMonto(monto),
        day_of_month: diaNum,
        payment_method: medio,
        category_id: suscripciones?.id ?? null,
      });
      await syncRecurringCharges();
    },
    onSuccess: async () => {
      setNombre("");
      setMonto("");
      setDia("");
      await refrescar();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo crear."),
  });

  const total = cargos.reduce((n, c) => n + c.amount, 0);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Cargos fijos</h3>
        {cargos.length > 0 ? (
          <span className="text-sm font-semibold text-slate-700">{clp(total)} al mes</span>
        ) : null}
      </div>
      <ul className="divide-y rounded-xl border">
        {cargos.length === 0 ? (
          <li className="px-3 py-3 text-sm text-slate-500">
            Suscripciones que se cobran solas (ChatGPT, Canva, CapCut…).
          </li>
        ) : (
          cargos.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="block text-xs text-slate-500">
                  Día {c.day_of_month} · {c.payment_method === "credito" ? "Tarjeta" : "Débito"}
                </span>
              </span>
              <Input
                aria-label={`Monto de ${c.name}`}
                inputMode="numeric"
                defaultValue={clp(c.amount)}
                className="h-9 w-28 text-right"
                onBlur={async (e) => {
                  const n = parseMonto(e.target.value);
                  if (!n || n === c.amount) return;
                  await updateRecurringCharge(c.id, { amount: n }).catch(() => null);
                  await refrescar();
                }}
              />
              <Quitar
                label={`Quitar ${c.name}`}
                onClick={async () => {
                  await archive("recurring_charges", c.id);
                  await refrescar();
                }}
              />
            </li>
          ))
        )}
      </ul>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (nombre.trim() && parseMonto(monto) > 0 && dia) crear.mutate();
        }}
      >
        <div className="flex gap-2">
          <Input
            aria-label="Nombre del cargo fijo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. ChatGPT"
            className="flex-1"
          />
          <Input
            aria-label="Monto"
            inputMode="numeric"
            value={monto}
            onChange={(e) => {
              const n = parseMonto(e.target.value);
              setMonto(n ? clp(n) : "");
            }}
            placeholder="Monto"
            className="w-28"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="cargo-dia" className="shrink-0 text-sm font-normal text-slate-600">
            Se cobra el día
          </Label>
          <Input
            id="cargo-dia"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            className="w-20"
          />
          <select
            aria-label="Medio de pago"
            value={medio}
            onChange={(e) => setMedio(e.target.value as PaymentMethod)}
            className="h-10 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="credito">Tarjeta de crédito</option>
            <option value="debito">Débito</option>
          </select>
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={!nombre.trim() || parseMonto(monto) <= 0 || !dia || crear.isPending}
        >
          Agregar cargo fijo
        </Button>
      </form>
      <p className="text-xs text-slate-500">
        Se anotan solos cada mes en su día. Si cobran en dólares, ajusta el monto cuando llegue el
        estado de cuenta.
      </p>
    </section>
  );
}

// ------------------------------------------------------------

function CategoriasEditor({ categorias }: { categorias: CategoryRow[] }) {
  const refrescar = useRefrescar();
  const [nombre, setNombre] = useState("");

  const crear = useMutation({
    mutationFn: () => createCategory(nombre, COLORES[categorias.length % COLORES.length]),
    onSuccess: async () => {
      setNombre("");
      await refrescar();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo crear."),
  });

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Categorías de gasto
      </h3>
      <ul className="divide-y rounded-xl border">
        {categorias.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-1.5">
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded"
              style={{ background: c.color ?? "#cbd5e1" }}
            />
            <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
            <Quitar
              label={`Quitar ${c.name}`}
              onClick={async () => {
                await archive("finance_categories", c.id);
                await refrescar();
              }}
            />
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (nombre.trim()) crear.mutate();
        }}
      >
        <Input
          aria-label="Nueva categoría"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Mascotas"
          className="flex-1"
        />
        <Button type="submit" disabled={!nombre.trim() || crear.isPending}>
          Agregar
        </Button>
      </form>
    </section>
  );
}
