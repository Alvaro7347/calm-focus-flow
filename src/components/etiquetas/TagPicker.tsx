/**
 * TagPicker — elegir etiquetas de una actividad.
 *
 * Pensado para el iPhone: todas las etiquetas a la vista como chips
 * que se tocan para activar/desactivar, y un campo para filtrar o
 * crear una nueva al vuelo ("Crear «Instagram»"). Sin pantallas extra.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Tag } from "lucide-react";
import { Label } from "@/components/ui/label";
import { createTag, fetchTags } from "@/services/tagService";

interface Props {
  value: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

export function TagPicker({ value, onChange, disabled }: Props) {
  const qc = useQueryClient();
  const { data: tags = [] } = useQuery({ queryKey: ["tags"], queryFn: fetchTags });
  const [text, setText] = useState("");
  const [creating, setCreating] = useState(false);

  const query = text.trim().toLowerCase();
  const visible = useMemo(
    () => (query ? tags.filter((t) => t.name.toLowerCase().includes(query)) : tags),
    [tags, query],
  );
  const exact = tags.find((t) => t.name.toLowerCase() === query);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  async function create() {
    const name = text.trim();
    if (!name) return;
    if (exact) {
      if (!value.includes(exact.id)) onChange([...value, exact.id]);
      setText("");
      return;
    }
    setCreating(true);
    try {
      const tag = await createTag(name);
      await qc.invalidateQueries({ queryKey: ["tags"] });
      onChange([...value, tag.id]);
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la etiqueta.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2 min-w-0">
      <Label className="flex items-center gap-1.5">
        <Tag className="h-3.5 w-3.5" aria-hidden="true" />
        Etiquetas
      </Label>

      {visible.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {visible.map((t) => {
            const on = value.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                disabled={disabled}
                aria-pressed={on}
                className={`min-h-[36px] rounded-full border px-3 text-sm transition-colors ${
                  on
                    ? "border-[color:var(--brand-violet)] bg-[color:var(--brand-violet)]/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void create();
            }
          }}
          maxLength={40}
          disabled={disabled || creating}
          placeholder={
            tags.length > 0 ? "Buscar o crear etiqueta" : "Crear etiqueta (ej: Instagram)"
          }
          className="min-h-[40px] flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50"
        />
        {query && !exact ? (
          <button
            type="button"
            onClick={() => void create()}
            disabled={disabled || creating}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-md border border-border px-3 text-sm text-foreground hover:bg-muted disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Crear
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Opcionales. Sirven para medir, por ejemplo, cuánto va a Instagram o a Contenido.
      </p>
    </div>
  );
}
