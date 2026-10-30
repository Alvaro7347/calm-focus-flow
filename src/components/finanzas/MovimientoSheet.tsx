/**
 * ========================================================
 * MovimientoSheet — registrar o editar un movimiento
 *
 * Hoja que sube desde abajo (en computador, un panel lateral) con tres
 * tipos: Gasto · Ingreso · Pagar tarjeta.
 * - Gasto: monto, categoría (botones), con qué pagaste, fecha, nota.
 * - Ingreso: monto, fuente, fecha, nota.
 * - Pagar tarjeta: monto, fecha, nota. Baja la deuda; no es gasto.
 * Al editar uno existente aparece "Eliminar" (para corregir errores).
 * ========================================================
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  clp,
  deleteMovement,
  localDate,
  parseMonto,
  saveMovement,
  type CategoryRow,
  type IncomeSourceRow,
  type MovementKind,
  type MovementRow,
  type PaymentMethod,
} from "@/services/financeService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: CategoryRow[];
  fuentes: IncomeSourceRow[];
  /** Si viene, se edita ese movimiento. */
  movimiento?: MovementRow | null;
  /** Tipo con que se abre al crear (por defecto, Gasto). */
  tipoInicial?: MovementKind;
  /** Para crear una categoría o fuente que falta. */
  onAbrirAjustes?: () => void;
}

const TIPOS: { id: MovementKind; label: string }[] = [
  { id: "expense", label: "Gasto" },
  { id: "income", label: "Ingreso" },
  { id: "card_payment", label: "Pagar tarjeta" },
];

export function MovimientoSheet({
  open,
  onOpenChange,
  categorias,
  fuentes,
  movimiento,
  tipoInicial = "expense",
  onAbrirAjustes,
}: Props) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<MovementKind>(tipoInicial);
  const [monto, setMonto] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [fuenteId, setFuenteId] = useState<string | null>(null);
  const [medio, setMedio] = useState<PaymentMethod>("debito");
  const [fecha, setFecha] = useState(localDate(new Date()));
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (!open) return;
    setTipo((movimiento?.kind as MovementKind) ?? tipoInicial);
    setMonto(movimiento ? clp(movimiento.amount) : "");
    setCategoriaId(movimiento?.category_id ?? null);
    setFuenteId(movimiento?.income_source_id ?? null);
    setMedio((movimiento?.payment_method as PaymentMethod) ?? "debito");
    setFecha(movimiento?.occurred_on ?? localDate(new Date()));
    setNota(movimiento?.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, movimiento?.id]);

  const montoNum = parseMonto(monto);
  const listo =
    montoNum > 0 &&
    !!fecha &&
    (tipo !== "expense" || !!categoriaId) &&
    (tipo !== "income" || !!fuenteId);

  const guardar = useMutation({
    mutationFn: () =>
      saveMovement({
        id: movimiento?.id,
        kind: tipo,
        amount: montoNum,
        occurred_on: fecha,
        category_id: tipo === "expense" ? categoriaId : null,
        income_source_id: tipo === "income" ? fuenteId : null,
        payment_method: tipo === "expense" ? medio : null,
        note: nota.trim() || null,
      }),
    onSuccess: async () => {
      toast.success(
        tipo === "expense"
          ? "Gasto guardado."
          : tipo === "income"
            ? "Ingreso guardado."
            : "Pago de tarjeta guardado.",
      );
      await qc.invalidateQueries({ queryKey: ["finanzas"] });
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo guardar."),
  });

  const eliminar = useMutation({
    mutationFn: () => deleteMovement(movimiento!.id),
    onSuccess: async () => {
      toast.success("Movimiento eliminado.");
      await qc.invalidateQueries({ queryKey: ["finanzas"] });
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar."),
  });

  const busy = guardar.isPending || eliminar.isPending;
  const chip = (on: boolean) =>
    `min-h-[40px] rounded-full px-3.5 text-sm transition-colors ${
      on
        ? "border-2 border-indigo-600 bg-indigo-50 font-semibold text-indigo-900"
        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
    }`;

  return (
    <Sheet open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-3xl px-5 pb-6 pt-4 md:mx-auto md:max-w-lg"
      >
        <SheetHeader className="text-left">
          <SheetTitle>{movimiento ? "Editar movimiento" : "Registrar"}</SheetTitle>
          <SheetDescription className="sr-only">
            Registra un gasto, un ingreso o un pago de tarjeta.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (listo) guardar.mutate();
          }}
          className="mt-4 space-y-5"
        >
          <div role="tablist" aria-label="Tipo de movimiento" className="grid grid-cols-3 gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tipo === t.id}
                onClick={() => setTipo(t.id)}
                className={`min-h-[48px] rounded-2xl text-sm transition-colors ${
                  tipo === t.id
                    ? "border-2 border-slate-900 bg-slate-900 font-bold text-white"
                    : "border border-slate-200 bg-white font-semibold text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="text-center">
            <Label htmlFor="fin-monto" className="text-slate-500">
              Monto
            </Label>
            <input
              id="fin-monto"
              inputMode="numeric"
              autoFocus={!movimiento}
              value={monto}
              onChange={(e) => {
                const n = parseMonto(e.target.value);
                setMonto(n > 0 ? clp(n) : "");
              }}
              placeholder="$0"
              className="w-full bg-transparent text-center text-4xl font-extrabold tracking-tight text-slate-900 outline-none placeholder:text-slate-300"
            />
          </div>

          {tipo === "expense" ? (
            <>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-slate-600">Categoría</legend>
                <div className="flex flex-wrap gap-2">
                  {categorias.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={categoriaId === c.id}
                      onClick={() => setCategoriaId(c.id)}
                      className={chip(categoriaId === c.id)}
                    >
                      {c.name}
                    </button>
                  ))}
                  {onAbrirAjustes ? (
                    <button
                      type="button"
                      onClick={onAbrirAjustes}
                      className="min-h-[40px] rounded-full border border-dashed border-slate-400 px-3.5 text-sm font-semibold text-indigo-700"
                    >
                      + Nueva
                    </button>
                  ) : null}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-slate-600">
                  Con qué pagaste
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["debito", "Débito o efectivo"],
                      ["credito", "Tarjeta de crédito"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={medio === id}
                      onClick={() => setMedio(id)}
                      className={`min-h-[48px] rounded-2xl text-sm ${
                        medio === id
                          ? "border-2 border-indigo-600 bg-indigo-50 font-bold text-indigo-900"
                          : "border border-slate-200 bg-white font-semibold text-slate-700"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          ) : null}

          {tipo === "income" ? (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-600">Fuente</legend>
              {fuentes.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Aún no tienes fuentes de ingreso.{" "}
                  {onAbrirAjustes ? (
                    <button
                      type="button"
                      onClick={onAbrirAjustes}
                      className="font-semibold text-indigo-700 underline"
                    >
                      Crear una
                    </button>
                  ) : null}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {fuentes.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={fuenteId === f.id}
                      onClick={() => {
                        setFuenteId(f.id);
                        if (!monto && f.expected_amount) setMonto(clp(f.expected_amount));
                      }}
                      className={chip(fuenteId === f.id)}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
          ) : null}

          {tipo === "card_payment" ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Pagar la tarjeta baja lo que debes. No cuenta como gasto: los gastos ya los anotaste
              cuando ocurrieron.
            </p>
          ) : null}

          <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fin-fecha">Fecha</Label>
              <Input
                id="fin-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fin-nota">Nota (opcional)</Label>
              <Input
                id="fin-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej. Almuerzo"
                maxLength={120}
              />
            </div>
          </div>

          <div className="flex gap-2">
            {movimiento ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-[52px] text-rose-600"
                disabled={busy}
                onClick={() => eliminar.mutate()}
              >
                Eliminar
              </Button>
            ) : null}
            <Button
              type="submit"
              className="min-h-[52px] flex-1 rounded-2xl text-base"
              disabled={!listo || busy}
            >
              {guardar.isPending
                ? "Guardando…"
                : tipo === "expense"
                  ? "Guardar gasto"
                  : tipo === "income"
                    ? "Guardar ingreso"
                    : "Guardar pago"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
