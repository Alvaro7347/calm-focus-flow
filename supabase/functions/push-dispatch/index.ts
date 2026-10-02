// Edge Function: push-dispatch
// Ejecutada por Supabase Cron cada minuto (via pg_cron + pg_net).
// Responsable de:
//  1. Detectar eventos de prioridad alta que comienzan en ~15 min.
//  2. Resúmenes del día ("secretaria"), a la hora local de cada usuario:
//     matutino (agenda de hoy), mediodía (avance) y vespertino (cierre).
//  3. Enviar las alarmas configuradas por el usuario en cada actividad
//     (tabla task_reminders: "5 min antes", "15 min antes", etc.).
//  4. Enviar Web Push a todas las suscripciones activas del usuario.
//  5. Registrar cada entrega en notification_deliveries (idempotencia
//     garantizada por UNIQUE(dedupe_key)).
//  6. Desactivar suscripciones expiradas (410 / 404).
//
// Autenticación: header `x-dispatch-secret` que debe coincidir con
// PUSH_DISPATCH_SECRET. No expone service_role al cliente.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
// deno-lint-ignore no-explicit-any
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:soporte@calmapp.app";
// Nota: PUSH_DISPATCH_SECRET vive en `public.internal_config` (clave
// `push_dispatch_secret`) para que cron y edge function compartan el mismo
// valor sin depender del env var (que puede haber sido generado sin exponer
// su valor). Se lee al invocar la función.

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface PushSub {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

interface Payload {
  type:
    | "event_reminder"
    | "daily_high_priority_summary"
    | "task_reminder"
    | "summary_morning"
    | "summary_midday"
    | "summary_evening";
  title: string;
  body: string;
  url: string;
  tag?: string;
}

async function sendToSubscription(sub: PushSub, payload: Payload): Promise<{
  ok: boolean;
  gone?: boolean;
  error?: string;
}> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key },
      },
      JSON.stringify(payload),
      { TTL: 60 * 30 },
    );
    return { ok: true };
  } catch (err) {
    // deno-lint-ignore no-explicit-any
    const e = err as any;
    const status = e?.statusCode ?? 0;
    if (status === 404 || status === 410) return { ok: false, gone: true, error: `expired ${status}` };
    return { ok: false, error: `push_error ${status || e?.message || "unknown"}` };
  }
}

async function recordDelivery(row: {
  user_id: string;
  subscription_id: string;
  notification_type: string;
  activity_id?: string | null;
  logical_date?: string | null;
  dedupe_key: string;
  status: "sent" | "failed" | "expired";
  error_summary?: string | null;
}): Promise<boolean> {
  // Inserta con UNIQUE(dedupe_key) — si ya existe, devuelve error 23505 y
  // sabemos que otro tick ya envió esta notificación.
  const { error } = await admin.from("notification_deliveries").insert(row);
  if (error) {
    if ((error as { code?: string }).code === "23505") return false;
    console.warn("[push-dispatch] delivery insert error:", error.message);
    return false;
  }
  return true;
}

async function deactivateSubscription(id: string, reason: string) {
  await admin
    .from("push_subscriptions")
    .update({ is_active: false, deactivated_at: new Date().toISOString() })
    .eq("id", id);
  console.log(`[push-dispatch] subscription ${id} deactivated: ${reason}`);
}

async function fetchActiveSubs(userId: string): Promise<PushSub[]> {
  const { data } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth_key")
    .eq("user_id", userId)
    .eq("is_active", true);
  return data ?? [];
}

async function fetchPrefs(userId: string) {
  // select("*"): tolera que las columnas de resúmenes aún no existan.
  const { data } = await admin
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const d = (data ?? {}) as Record<string, any>;
  // Defaults si no existe fila o columna.
  return {
    notifications_enabled: d.notifications_enabled ?? true,
    event_reminders_enabled: d.event_reminders_enabled ?? true,
    daily_summary_enabled: d.daily_summary_enabled ?? true,
    daily_summary_hour: d.daily_summary_hour ?? 18,
    daily_summary_minute: d.daily_summary_minute ?? 0,
    morning_summary_enabled: d.morning_summary_enabled ?? true,
    morning_summary_hour: d.morning_summary_hour ?? 8,
    morning_summary_minute: d.morning_summary_minute ?? 0,
    midday_summary_enabled: d.midday_summary_enabled ?? true,
    midday_summary_hour: d.midday_summary_hour ?? 13,
    midday_summary_minute: d.midday_summary_minute ?? 0,
  };
}

function fmtHm(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// Formatea una hora en la zona local del usuario (tz IANA).
function fmtHmLocal(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("es", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return fmtHm(iso);
  }
}

// ============================================================
// EVENT REMINDERS
// ============================================================
async function processEventReminders(): Promise<{ candidates: number; sent: number }> {
  const now = new Date();
  // Ventana: eventos que empiezan entre (now + 14min) y (now + 16min).
  // Cron corre cada minuto → cada evento cae en la ventana 2 veces como máximo,
  // pero el UNIQUE(dedupe_key) impide duplicados.
  const windowStart = new Date(now.getTime() + 14 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 16 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  const { data: events, error } = await admin
    .from("tasks")
    .select("id, user_id, title, starts_at, ends_at, priority, activity_type, archived_at")
    .eq("activity_type", "event")
    .eq("priority", "high")
    .neq("status", "not_done") // "No fui": no avisar
    .is("archived_at", null)
    .gte("starts_at", nowIso)
    .lte("starts_at", windowEnd)
    .gte("starts_at", windowStart);

  if (error) {
    console.error("[push-dispatch] events query error:", error.message);
    return { candidates: 0, sent: 0 };
  }

  // Si el usuario configuró su propia alarma para el evento, esa manda:
  // no enviamos además el aviso automático de 15 min (evita duplicados).
  const eventIds = (events ?? []).map((e) => e.id);
  const withCustomReminder = new Set<string>();
  if (eventIds.length > 0) {
    const { data: rems } = await admin
      .from("task_reminders")
      .select("task_id")
      .in("task_id", eventIds);
    for (const r of rems ?? []) withCustomReminder.add(r.task_id);
  }

  let sent = 0;
  for (const ev of events ?? []) {
    if (withCustomReminder.has(ev.id)) continue;
    const prefs = await fetchPrefs(ev.user_id);
    if (!prefs.notifications_enabled || !prefs.event_reminders_enabled) continue;

    const subs = await fetchActiveSubs(ev.user_id);
    if (subs.length === 0) continue;

    // Zona horaria del usuario para formatear horas legibles.
    const { data: profile } = await admin
      .from("profiles")
      .select("timezone")
      .eq("id", ev.user_id)
      .maybeSingle();
    const tz = profile?.timezone ?? "UTC";
    const hi = fmtHmLocal(ev.starts_at!, tz);
    const hf = ev.ends_at ? fmtHmLocal(ev.ends_at, tz) : "";

    const payload: Payload = {
      type: "event_reminder",
      title: "Comienza pronto",
      body: hf
        ? `En 15 minutos comienza "${ev.title}". De ${hi} a ${hf}.`
        : `En 15 minutos comienza "${ev.title}" a las ${hi}.`,
      url: `/calendario?event=${ev.id}`,
      tag: `event-${ev.id}`,
    };

    for (const sub of subs) {
      // La clave incluye starts_at, así que cambiar el horario reevalúa envío.
      const dedupe = `event_reminder:${ev.id}:${ev.starts_at}:${sub.id}`;

      const claimed = await recordDelivery({
        user_id: ev.user_id,
        subscription_id: sub.id,
        notification_type: "event_reminder",
        activity_id: ev.id,
        dedupe_key: dedupe,
        status: "sent",
      });
      if (!claimed) continue; // ya enviado por otro tick

      const res = await sendToSubscription(sub, payload);
      if (res.ok) {
        sent++;
      } else {
        // Actualiza el registro a failed/expired.
        await admin
          .from("notification_deliveries")
          .update({
            status: res.gone ? "expired" : "failed",
            error_summary: res.error?.slice(0, 200) ?? null,
          })
          .eq("dedupe_key", dedupe);
        if (res.gone) await deactivateSubscription(sub.id, res.error ?? "gone");
      }
    }
  }

  return { candidates: events?.length ?? 0, sent };
}

// ============================================================
// TASK REMINDERS (alarmas configuradas por el usuario)
// ============================================================
function humanLead(minutes: number): string {
  if (minutes <= 0) return "Ahora";
  if (minutes < 60) return `En ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  if (minutes < 1440) {
    const h = Math.round(minutes / 60);
    return `En ${h} ${h === 1 ? "hora" : "horas"}`;
  }
  const d = Math.round(minutes / 1440);
  return d === 1 ? "Mañana" : `En ${d} días`;
}

async function processTaskReminders(): Promise<{ candidates: number; sent: number }> {
  const now = new Date();
  const nowIso = now.toISOString();
  // Tolerancia: una alarma "a la hora" puede procesarse hasta 5 min
  // después del inicio (por si un tick del cron se retrasa).
  const graceMs = 5 * 60 * 1000;
  // No revisamos alarmas pendientes más antiguas que 2 días.
  const oldestIso = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await admin
    .from("task_reminders")
    .select(
      "id, task_id, remind_at, tasks!inner(id, user_id, title, starts_at, ends_at, status, activity_type, archived_at)",
    )
    .is("sent_at", null)
    .lte("remind_at", nowIso)
    .gte("remind_at", oldestIso);

  if (error) {
    console.error("[push-dispatch] task_reminders query error:", error.message);
    return { candidates: 0, sent: 0 };
  }

  let sent = 0;
  for (const row of rows ?? []) {
    // deno-lint-ignore no-explicit-any
    const task = (row as any).tasks as {
      id: string;
      user_id: string;
      title: string;
      starts_at: string | null;
      ends_at: string | null;
      status: string;
      activity_type: string;
      archived_at: string | null;
    } | null;

    // "Reclamamos" la alarma de forma atómica: sólo un tick la procesa.
    const { data: claimed } = await admin
      .from("task_reminders")
      .update({ sent_at: nowIso })
      .eq("id", row.id)
      .is("sent_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    if (!task || !task.starts_at) continue;
    if (task.archived_at || task.status === "completed" || task.status === "not_done") continue;
    const startMs = new Date(task.starts_at).getTime();
    if (startMs + graceMs < now.getTime()) continue; // ya pasó: no molestar

    const prefs = await fetchPrefs(task.user_id);
    if (!prefs.notifications_enabled) continue;

    const subs = await fetchActiveSubs(task.user_id);
    if (subs.length === 0) continue;

    const { data: profile } = await admin
      .from("profiles")
      .select("timezone")
      .eq("id", task.user_id)
      .maybeSingle();
    const tz = profile?.timezone ?? "UTC";
    const hi = fmtHmLocal(task.starts_at, tz);
    const hf = task.ends_at ? fmtHmLocal(task.ends_at, tz) : "";

    const minutesLeft = Math.max(0, Math.round((startMs - now.getTime()) / 60000));
    const lead = humanLead(minutesLeft);
    const isEvent = task.activity_type === "event";
    const verbo = isEvent ? "comienza" : "toca";

    const payload: Payload = {
      type: "task_reminder",
      title: minutesLeft <= 0 ? "Es la hora" : "Recordatorio",
      body:
        minutesLeft <= 0
          ? `Ahora ${verbo} "${task.title}" (${hi}${hf ? ` a ${hf}` : ""}).`
          : `${lead} ${verbo} "${task.title}" a las ${hi}${hf ? `, hasta las ${hf}` : ""}.`,
      url: `/calendario?event=${task.id}`,
      tag: `task-reminder-${task.id}`,
    };

    for (const sub of subs) {
      const dedupe = `task_reminder:${row.id}:${row.remind_at}:${sub.id}`;
      const ok = await recordDelivery({
        user_id: task.user_id,
        subscription_id: sub.id,
        notification_type: "task_reminder",
        activity_id: task.id,
        dedupe_key: dedupe,
        status: "sent",
      });
      if (!ok) continue;

      const res = await sendToSubscription(sub, payload);
      if (res.ok) {
        sent++;
      } else {
        await admin
          .from("notification_deliveries")
          .update({
            status: res.gone ? "expired" : "failed",
            error_summary: res.error?.slice(0, 200) ?? null,
          })
          .eq("dedupe_key", dedupe);
        if (res.gone) await deactivateSubscription(sub.id, res.error ?? "gone");
      }
    }
  }

  return { candidates: rows?.length ?? 0, sent };
}

// ============================================================
// DAILY SUMMARY
// ============================================================
function localHmDate(now: Date, tz: string): { hour: number; minute: number; ymd: string } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const h = parseInt(g("hour"), 10);
    const m = parseInt(g("minute"), 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return { hour: h, minute: m, ymd: `${g("year")}-${g("month")}-${g("day")}` };
  } catch {
    return null;
  }
}

// Fin del día en la zona local expresado en UTC ISO.
function endOfLocalDayUtc(ymd: string, tz: string): string {
  // Interpretamos ymd 23:59:59 en tz como UTC. Aproximación mediante Intl.
  const d = new Date(`${ymd}T23:59:59Z`);
  // ajustar con offset actual de esa TZ
  const tzOffsetMin = getTzOffsetMinutes(d, tz);
  return new Date(d.getTime() - tzOffsetMin * 60 * 1000).toISOString();
}

function getTzOffsetMinutes(when: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(when);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const asUtc = Date.UTC(
    parseInt(g("year")),
    parseInt(g("month")) - 1,
    parseInt(g("day")),
    parseInt(g("hour")),
    parseInt(g("minute")),
    parseInt(g("second")),
  );
  return Math.round((asUtc - when.getTime()) / 60000);
}

// ------------------------------------------------------------
// Resúmenes del día ("secretaria"): matutino, mediodía, vespertino
// ------------------------------------------------------------

type SummarySlot = "morning" | "midday" | "evening";

function startOfLocalDayUtc(ymd: string, tz: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  const tzOffsetMin = getTzOffsetMinutes(d, tz);
  return new Date(d.getTime() - tzOffsetMin * 60 * 1000).toISOString();
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

type DayItem = {
  title: string;
  status: string;
  activity_type: string;
  priority: string;
  starts_at: string | null;
  completed_at: string | null;
  areas: { archived_at: string | null } | null;
};

/** Máximo de actividades listadas en el cuerpo de un resumen. */
const MAX_LINES = 5;

/** "09:00 Título" si tiene hora; "• Título" si es de todo el día. */
function itemLine(t: DayItem, tz: string): string {
  if (!t.starts_at) return `• ${t.title}`;
  const hm = fmtHmLocal(t.starts_at, tz);
  const isAllDay = hm === "00:00";
  const mark = t.priority === "high" && t.activity_type === "task" ? " (importante)" : "";
  return isAllDay ? `• ${t.title}${mark}` : `${hm} ${t.title}${mark}`;
}

function listLines(items: DayItem[], tz: string, max = MAX_LINES): string[] {
  const lines = items.slice(0, max).map((t) => itemLine(t, tz));
  if (items.length > max) lines.push(`+${items.length - max} más`);
  return lines;
}

/**
 * Arma el mensaje de un resumen, estilo "secretaria": título con el
 * panorama y cuerpo con el detalle de las actividades (una por línea).
 * Devuelve null si no hay nada que decir (evita notificaciones vacías).
 */
async function buildSummary(
  slot: SummarySlot,
  userId: string,
  ymd: string,
  tz: string,
  now: Date,
): Promise<{ title: string; body: string } | null> {
  const dayStart = startOfLocalDayUtc(ymd, tz);
  const dayEnd = endOfLocalDayUtc(ymd, tz);

  const [dayRes, overdueRes] = await Promise.all([
    admin
      .from("tasks")
      .select("title, status, activity_type, priority, starts_at, completed_at, areas(archived_at)")
      .eq("user_id", userId)
      .is("archived_at", null)
      .or(
        `and(starts_at.gte.${dayStart},starts_at.lte.${dayEnd}),and(completed_at.gte.${dayStart},completed_at.lte.${dayEnd})`,
      ),
    admin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("activity_type", "task")
      .in("status", ["pending", "waiting"])
      .is("archived_at", null)
      .lt("starts_at", dayStart),
  ]);
  if (dayRes.error) {
    console.warn("[push-dispatch] summary query error:", dayRes.error.message);
    return null;
  }
  const overdue = overdueRes.count ?? 0;
  const items = ((dayRes.data ?? []) as unknown as DayItem[]).filter((t) => !t.areas?.archived_at);

  const startMs = new Date(dayStart).getTime();
  const endMs = new Date(dayEnd).getTime();
  const inDay = (iso: string | null) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= startMs && t <= endMs;
  };
  const byTime = (a: DayItem, b: DayItem) =>
    new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime();
  // Importantes primero dentro de la misma hora (todo el día queda al inicio).
  const scheduled = items.filter((t) => inDay(t.starts_at)).sort(byTime);
  // "No la hice" / "No fui" no cuenta en ningún conteo.
  const tasksToday = scheduled.filter((t) => t.activity_type === "task" && t.status !== "not_done");
  const events = scheduled.filter((t) => t.activity_type === "event" && t.status !== "not_done");
  // Abiertas = pendientes o en espera ("No la hice" no cuenta).
  const isOpen = (t: DayItem) => t.status === "pending" || t.status === "waiting";
  const pending = tasksToday.filter(isOpen);
  const doneToday = items.filter(
    (t) => t.activity_type === "task" && t.status === "completed" && inDay(t.completed_at),
  );
  const overdueLine =
    overdue > 0
      ? `Además, ${plural(overdue, "pendiente", "pendientes")} de días anteriores.`
      : null;

  if (slot === "morning") {
    const agenda = scheduled.filter((t) =>
      t.activity_type === "event" ? t.status !== "not_done" : isOpen(t),
    );
    if (agenda.length === 0) {
      return {
        title: "Buenos días · Día libre de agenda",
        body: [
          "Hoy no tienes actividades agendadas. Un buen día para avanzar en lo importante.",
          overdueLine,
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }
    const summary = [
      pending.length > 0 ? plural(pending.length, "tarea", "tareas") : null,
      events.length > 0 ? plural(events.length, "evento", "eventos") : null,
    ]
      .filter(Boolean)
      .join(" y ");
    return {
      title: `Buenos días · Hoy: ${summary}`,
      body: [...listLines(agenda, tz), overdueLine].filter(Boolean).join("\n"),
    };
  }

  if (slot === "midday") {
    const upcoming = scheduled.filter(
      (t) =>
        (t.activity_type === "event" ? t.status !== "not_done" : isOpen(t)) &&
        (t.activity_type === "event"
          ? new Date(t.starts_at!).getTime() > now.getTime()
          : true),
    );
    if (tasksToday.length === 0 && events.length === 0 && doneToday.length === 0) return null;
    const title =
      tasksToday.length > 0
        ? `Mitad del día · ${tasksToday.length - pending.length} de ${tasksToday.length} hechas`
        : `Mitad del día · ${plural(doneToday.length, "completada", "completadas")}`;
    const lines =
      upcoming.length > 0
        ? ["Lo que queda:", ...listLines(upcoming, tz)]
        : ["No queda nada agendado para la tarde."];
    return { title, body: lines.join("\n") };
  }

  // evening
  if (doneToday.length === 0 && pending.length === 0) return null;
  const lines: string[] = [];
  for (const t of doneToday.slice(0, 3)) lines.push(`✓ ${t.title}`);
  if (doneToday.length > 3) lines.push(`✓ +${doneToday.length - 3} más`);
  if (pending.length > 0) {
    lines.push(
      `Quedan ${pending.length}: ${pending
        .slice(0, 3)
        .map((t) => t.title)
        .join(", ")}${pending.length > 3 ? "…" : ""}`,
    );
    lines.push("Puedes pasarlas a mañana con calma.");
  } else {
    lines.push("No quedan pendientes de hoy. Buen cierre.");
  }
  const title =
    doneToday.length > 0
      ? `Cierre del día · ${plural(doneToday.length, "completada", "completadas")}`
      : "Cierre del día";
  return { title, body: lines.join("\n") };
}

async function processDailySummaries(): Promise<{ users: number; sent: number }> {
  const now = new Date();

  // Solo consideramos usuarios con al menos una suscripción activa.
  const { data: users, error } = await admin
    .from("push_subscriptions")
    .select("user_id")
    .eq("is_active", true);
  if (error) {
    console.error("[push-dispatch] subs query error:", error.message);
    return { users: 0, sent: 0 };
  }
  const uniqueUsers = Array.from(new Set((users ?? []).map((r) => r.user_id)));

  let sent = 0;
  for (const userId of uniqueUsers) {
    const prefs = await fetchPrefs(userId);
    if (!prefs.notifications_enabled) continue;

    const { data: profile } = await admin
      .from("profiles")
      .select("timezone")
      .eq("id", userId)
      .maybeSingle();
    const tz = profile?.timezone ?? "UTC";
    const local = localHmDate(now, tz);
    if (!local) continue;
    const localMinutes = local.hour * 60 + local.minute;

    const slots: { slot: SummarySlot; enabled: boolean; h: number; m: number }[] = [
      {
        slot: "morning",
        enabled: prefs.morning_summary_enabled,
        h: prefs.morning_summary_hour,
        m: prefs.morning_summary_minute,
      },
      {
        slot: "midday",
        enabled: prefs.midday_summary_enabled,
        h: prefs.midday_summary_hour,
        m: prefs.midday_summary_minute,
      },
      {
        slot: "evening",
        enabled: prefs.daily_summary_enabled,
        h: prefs.daily_summary_hour,
        m: prefs.daily_summary_minute,
      },
    ];

    for (const s of slots) {
      if (!s.enabled) continue;
      // Ventana: [H:MM, H:MM+4min]. Cron corre cada minuto; el UNIQUE
      // (dedupe_key) por fecha local evita duplicados.
      const target = s.h * 60 + s.m;
      if (localMinutes < target || localMinutes > target + 4) continue;

      const message = await buildSummary(s.slot, userId, local.ymd, tz, now);
      if (!message) continue;

      const subs = await fetchActiveSubs(userId);
      if (subs.length === 0) continue;

      const type = `summary_${s.slot}` as Payload["type"];
      const payload: Payload = {
        type,
        title: message.title,
        body: message.body,
        url: "/foco",
        tag: `${type}-${local.ymd}`,
      };

      for (const sub of subs) {
        const dedupe = `${type}:${userId}:${local.ymd}:${sub.id}`;
        const claimed = await recordDelivery({
          user_id: userId,
          subscription_id: sub.id,
          notification_type: type,
          logical_date: local.ymd,
          dedupe_key: dedupe,
          status: "sent",
        });
        if (!claimed) continue;

        const res = await sendToSubscription(sub, payload);
        if (res.ok) {
          sent++;
        } else {
          await admin
            .from("notification_deliveries")
            .update({
              status: res.gone ? "expired" : "failed",
              error_summary: res.error?.slice(0, 200) ?? null,
            })
            .eq("dedupe_key", dedupe);
          if (res.gone) await deactivateSubscription(sub.id, res.error ?? "gone");
        }
      }
    }
  }

  return { users: uniqueUsers.length, sent };
}

// ============================================================
// HTTP HANDLER
// ============================================================
async function getDispatchSecret(): Promise<string | null> {
  const { data, error } = await admin
    .from("internal_config")
    .select("value")
    .eq("key", "push_dispatch_secret")
    .maybeSingle();
  if (error || !data) return null;
  return data.value;
}

Deno.serve(async (req) => {
  // Autenticación interna: solo pg_cron/admin autorizado puede invocar.
  const provided = req.headers.get("x-dispatch-secret");
  const expected = await getDispatchSecret();
  if (!expected || !provided || provided !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    const [events, reminders, summaries] = await Promise.all([
      processEventReminders(),
      processTaskReminders(),
      processDailySummaries(),
    ]);
    return new Response(
      JSON.stringify({ ok: true, events, reminders, summaries, ts: new Date().toISOString() }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    console.error("[push-dispatch] fatal:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
