/**
 * ElementDimensionField — asigna o cambia la Dimensión de un
 * Proyecto, Objetivo o Hábito ya existente (reasignación manual,
 * sin recrear el elemento). Si el Área no tiene Dimensiones, no
 * se muestra.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DimensionSelect } from "./DimensionSelect";
import { setElementDimension } from "@/services/dimensionService";
import { invalidateActivityGraph } from "@/lib/queryInvalidation";

interface Props {
  table: "projects" | "objectives" | "habits";
  id: string;
  areaId: string | undefined;
  dimensionId: string | null | undefined;
}

export function ElementDimensionField({ table, id, areaId, dimensionId }: Props) {
  const qc = useQueryClient();
  const [value, setValue] = useState<string | null>(dimensionId ?? null);
  const [saving, setSaving] = useState(false);

  async function change(next: string | null) {
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      await setElementDimension(table, id, next);
      await invalidateActivityGraph(qc);
      toast.success(next ? "Dimensión asignada." : "Quedó sin dimensión.");
    } catch (err) {
      setValue(prev);
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar la dimensión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DimensionSelect
      areaId={areaId}
      value={value}
      onChange={(v) => void change(v)}
      disabled={saving}
      label="Dimensión"
    />
  );
}
