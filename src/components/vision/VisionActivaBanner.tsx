/**
 * ========================================================
 * VisionActivaBanner — "Esto mueve" + visión contextual
 *
 * Se muestra arriba del detalle de una tarea existente:
 *  - Siempre: "Esto mueve: <Proyecto | Meta | Hábito>" (estructura).
 *  - A veces: la visión escrita por el usuario, sólo si el contexto
 *    lo justifica y queda cupo en el límite diario
 *    (ver `visionService`).
 *
 * Sobrio: sin puntos, rachas ni medallas.
 * ========================================================
 */
import { useEffect, useRef, useState } from "react";
import type { TaskWithHierarchy } from "@/services/taskService";
import {
  claimVisionSlot,
  getTaskVisionContext,
  type TaskVisionContext,
} from "@/services/visionService";

const KIND_LABEL: Record<TaskVisionContext["kind"], string> = {
  project: "Proyecto",
  goal: "Meta",
  habit: "Hábito",
};

export function VisionActivaBanner({ task }: { task: TaskWithHierarchy }) {
  const [ctx, setCtx] = useState<TaskVisionContext | null>(null);
  const [showVision, setShowVision] = useState(false);
  const decided = useRef(false);

  useEffect(() => {
    let cancelled = false;
    decided.current = false;
    setCtx(null);
    setShowVision(false);
    getTaskVisionContext(task)
      .then((c) => {
        if (cancelled || !c) return;
        setCtx(c);
        if (c.meaningful && !decided.current) {
          decided.current = true;
          setShowVision(claimVisionSlot(c.key));
        }
      })
      .catch(() => {
        // Silencioso: el detalle funciona igual sin este bloque.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.task.id]);

  if (!ctx) return null;

  return (
    <section aria-label="Esto mueve" className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">Esto mueve · {KIND_LABEL[ctx.kind]}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{ctx.name}</p>
      {showVision && ctx.vision ? (
        <div className="mt-3 border-l-2 border-[color:var(--brand-violet)]/40 pl-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {ctx.visionLabel}
          </p>
          <p className="mt-1 text-sm italic leading-relaxed text-foreground/75">“{ctx.vision}”</p>
        </div>
      ) : null}
    </section>
  );
}
