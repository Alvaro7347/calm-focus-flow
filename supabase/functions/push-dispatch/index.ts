// Edge Function: push-dispatch
// Ejecutada por Supabase Cron cada minuto (via pg_cron + pg_net).
// Responsable de:
//  1. Detectar eventos de prioridad alta que comienzan en ~15 min.
//  2. Detectar usuarios que están cruzando las 18:00 en su zona local
//     y enviarles un resumen consolidado de tareas altas pendientes.
//  3. Enviar Web Push a todas las suscripciones activas del usuario.
//  4. Registrar cada entrega en notification_deliveries (idempotencia
//     garantizada por UNIQUE(dedupe_key)).
//  5. Desactivar suscripciones expiradas (410 / 404).
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
  type: "event_reminder" | "daily_high_priority_summary";
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
  const { data } = await admin
    .from("notification_preferences")
    .select("notifications_enabled, event_reminders_enabled, daily_summary_enabled, daily_summary_hour, daily_summary_minute")
    .eq("user_id", userId)
    .maybeSingle();
  // Defaults si no existe fila.
  return {
    notifications_enabled: data?.notifications_enabled ?? true,
    event_reminders_enabled: data?.event_reminders_enabled ?? true,
    daily_summary_enabled: data?.daily_summary_enabled ?? true,
    daily_summary_hour: data?.daily_summary_hour ?? 18,
    daily_summary_minute: data?.daily_summary_minute ?? 0,
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
    .is("archived_at", null)
    .gte("starts_at", nowIso)
    .lte("starts_at", windowEnd)
    .gte("starts_at", windowStart);

  if (error) {
    console.error("[push-dispatch] events query error:", error.message);
    return { candidates: 0, sent: 0 };
  }

  let sent = 0;
  for (const ev of events ?? []) {
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
    if (!prefs.notifications_enabled || !prefs.daily_summary_enabled) continue;

    const { data: profile } = await admin
      .from("profiles")
      .select("timezone")
      .eq("id", userId)
      .maybeSingle();
    const tz = profile?.timezone ?? "UTC";
    const local = localHmDate(now, tz);
    if (!local) continue;

    // Ventana: [H:MM, H:MM+4min]. Cron corre cada minuto; el UNIQUE por fecha
    // local evita duplicados si el proceso dura más de un minuto.
    const targetH = prefs.daily_summary_hour;
    const targetM = prefs.daily_summary_minute;
    const localMinutes = local.hour * 60 + local.minute;
    const targetMinutes = targetH * 60 + targetM;
    if (localMinutes < targetMinutes || localMinutes > targetMinutes + 4) continue;

    // Contar tareas relevantes: prioridad alta, no archivadas, no completadas,
    // (sin fecha o con starts_at <= fin del día local).
    const endOfDayIso = endOfLocalDayUtc(local.ymd, tz);
    const { data: tasks, error: te } = await admin
      .from("tasks")
      .select("id, starts_at, status")
      .eq("user_id", userId)
      .eq("activity_type", "task")
      .eq("priority", "high")
      .is("archived_at", null)
      .in("status", ["pending", "waiting"])
      .or(`starts_at.is.null,starts_at.lte.${endOfDayIso}`);
    if (te) {
      console.warn("[push-dispatch] task summary query error:", te.message);
      continue;
    }
    const count = tasks?.length ?? 0;
    if (count === 0) continue;

    const subs = await fetchActiveSubs(userId);
    if (subs.length === 0) continue;

    const payload: Payload = {
      type: "daily_high_priority_summary",
      title: "Antes de cerrar el día",
      body:
        count === 1
          ? "Antes de cerrar el día, tienes una tarea importante pendiente."
          : `Antes de cerrar el día, tienes ${count} tareas importantes pendientes.`,
      url: "/foco?filter=high",
      tag: `daily-${local.ymd}`,
    };

    for (const sub of subs) {
      const dedupe = `daily_high_priority_summary:${userId}:${local.ymd}:${sub.id}`;
      const claimed = await recordDelivery({
        user_id: userId,
        subscription_id: sub.id,
        notification_type: "daily_high_priority_summary",
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

  return { users: uniqueUsers.length, sent };
}

// ============================================================
// HTTP HANDLER
// ============================================================
Deno.serve(async (req) => {
  // Autenticación interna: solo pg_cron/admin autorizado puede invocar.
  const provided = req.headers.get("x-dispatch-secret");
  if (!provided || provided !== DISPATCH_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    const [events, summaries] = await Promise.all([
      processEventReminders(),
      processDailySummaries(),
    ]);
    return new Response(
      JSON.stringify({ ok: true, events, summaries, ts: new Date().toISOString() }),
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
