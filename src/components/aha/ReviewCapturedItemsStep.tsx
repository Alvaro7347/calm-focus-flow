/**
 * ReviewCapturedItemsStep — revisar/editar/descartar los ítems parseados.
 * La IA (o heurística) solo sugiere: el usuario confirma cada ítem.
 */
import { Button } from "@/components/ui/button";
import type {
  CapturedItem,
  CapturedItemPriority,
  CapturedItemType,
  CapturedItemWhen,
} from "@/services/ahaService";

interface Props {
  items: CapturedItem[];
  onChange: (items: CapturedItem[]) => void;
  onContinue: () => void;
  onBack: () => void;
  submitting?: boolean;
}

const TYPES: { value: CapturedItemType; label: string }[] = [
  { value: "tarea", label: "Tarea" },
  { value: "idea", label: "Idea" },
  { value: "preocupacion", label: "Preocupación" },
  { value: "recordatorio", label: "Recordatorio" },
];
const PRIORITIES: { value: CapturedItemPriority; label: string }[] = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
];
const WHENS: { value: CapturedItemWhen; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "esta_semana", label: "Esta semana" },
  { value: "esperando", label: "Esperando" },
  { value: "mas_adelante", label: "Más adelante" },
];

export function ReviewCapturedItemsStep({
  items,
  onChange,
  onContinue,
  onBack,
  submitting,
}: Props) {
  const update = (id: string, patch: Partial<CapturedItem>) => {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  const confirmedCount = items.filter((i) => i.confirmed).length;

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
          Ordenemos lo que descargaste
        </p>
        <h2 className="text-xl font-semibold text-slate-900">
          CalmApp te sugiere una clasificación. Tú decides.
        </h2>
        <p className="text-sm text-slate-500">
          Edita, marca lo que sí quieres convertir en tarea, o descarta lo que no.
        </p>
      </div>

      <ul className="space-y-3">
        {items.map((it) => (
          <li
            key={it.id}
            className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={it.confirmed}
                onChange={(e) => update(it.id, { confirmed: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600"
                aria-label="Confirmar como tarea"
              />
              <input
                type="text"
                value={it.title}
                onChange={(e) => update(it.id, { title: e.target.value })}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                maxLength={200}
              />
              <button
                type="button"
                onClick={() => remove(it.id)}
                className="text-xs text-slate-500 hover:text-red-600"
              >
                Descartar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Select
                label="Tipo"
                value={it.type}
                options={TYPES}
                onChange={(v) => update(it.id, { type: v as CapturedItemType })}
              />
              <Select
                label="Prioridad"
                value={it.priority}
                options={PRIORITIES}
                onChange={(v) => update(it.id, { priority: v as CapturedItemPriority })}
              />
              <Select
                label="Cuándo"
                value={it.when}
                options={WHENS}
                onChange={(v) => update(it.id, { when: v as CapturedItemWhen })}
              />
            </div>
          </li>
        ))}
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No hay ítems para revisar.</p>
        ) : null}
      </ul>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {confirmedCount} confirmado{confirmedCount === 1 ? "" : "s"} de {items.length}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} disabled={submitting}>
            Atrás
          </Button>
          <Button
            size="sm"
            onClick={onContinue}
            disabled={confirmedCount === 0 || submitting}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Elegir próximos pasos
          </Button>
        </div>
      </div>
    </section>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
