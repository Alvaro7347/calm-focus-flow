/**
 * DimensionSelect — selector "Dimensión (opcional)".
 *
 * Muestra sólo las Dimensiones del Área indicada. Si el Área no
 * tiene Dimensiones, no se renderiza (cero fricción).
 */
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchDimensions } from "@/services/dimensionService";

const SIN_DIMENSION = "__none__";

interface Props {
  areaId: string | null | undefined;
  value: string | null;
  onChange: (dimensionId: string | null) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
}

export function DimensionSelect({
  areaId,
  value,
  onChange,
  disabled,
  label = "Dimensión (opcional)",
  hint,
}: Props) {
  const { data: dimensiones = [] } = useQuery({
    queryKey: ["dimensions", areaId],
    queryFn: () => fetchDimensions(areaId!).catch(() => []),
    enabled: !!areaId,
  });

  if (!areaId || dimensiones.length === 0) return null;
  // Si la Dimensión actual ya no está activa, se muestra como "Sin dimensión".
  const current = value && dimensiones.some((d) => d.id === value) ? value : SIN_DIMENSION;

  return (
    <div className="space-y-2 min-w-0">
      <Label>{label}</Label>
      <Select
        value={current}
        onValueChange={(v) => onChange(v === SIN_DIMENSION ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SIN_DIMENSION}>Sin dimensión</SelectItem>
          {dimensiones.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
