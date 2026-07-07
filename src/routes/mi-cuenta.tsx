/**
 * ========================================================
 * Ruta: /mi-cuenta
 *
 * Pantalla "Mi Cuenta" — información personal del usuario.
 *
 * Alcance (por diseño):
 *   • Foto de perfil (avatar + iniciales, placeholder para subir imagen).
 *   • Información personal: nombre, apellidos, email.
 *   • Preferencias personales: zona horaria, idioma, primer día de la
 *     semana, formato de fecha.
 *   • Información de la cuenta (solo lectura): fechas y versión.
 *
 * Fuera de alcance: cualquier configuración de aplicación (IA, Google
 * Calendar, notificaciones, tema, recordatorios, etc.). Todo eso vive
 * en la futura pantalla "Ajustes".
 *
 * Arquitectura:
 *   Pantalla  →  profileService  →  Supabase.
 * La pantalla NO consulta Supabase directamente. Cuando llegue Login,
 * el único cambio será dentro de profileService (origen del user_id).
 * ========================================================
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2, Save, Camera, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import {
  ensureCurrentProfile,
  updateCurrentProfile,
  type Profile,
  type ProfilePatch,
} from "@/services/profileService";
import {
  uploadCurrentUserAvatar,
  resolveAvatarUrl,
  AvatarUploadError,
} from "@/services/avatarService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MicroSurveyPrompt } from "@/components/research/MicroSurveyPrompt";

export const Route = createFileRoute("/mi-cuenta")({
  head: () => ({
    meta: [
      { title: "Mi Cuenta — CalmApp" },
      {
        name: "description",
        content: "Información personal y preferencias del usuario en CalmApp.",
      },
    ],
  }),
  component: MiCuentaPage,
});

const CALMAPP_VERSION = "0.1.0 · MVP1";

const TIMEZONES = [
  "America/Argentina/Buenos_Aires",
  "America/Santiago",
  "America/Bogota",
  "America/Mexico_City",
  "America/Lima",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "Europe/London",
  "UTC",
];

const LOCALES = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
];

const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

const profileSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  apellidos: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Correo inválido").max(255),
  timezone: z.string().min(1),
  locale: z.string().min(1),
  week_starts_on: z.union([z.literal(0), z.literal(1)]),
  date_format: z.string().min(1),
});

type FormState = {
  nombre: string;
  apellidos: string;
  email: string;
  timezone: string;
  locale: string;
  week_starts_on: 0 | 1;
  date_format: string;
};

function profileToForm(p: Profile): FormState {
  return {
    nombre: p.nombre ?? "",
    apellidos: p.apellidos ?? "",
    email: p.email ?? "",
    timezone: p.timezone,
    locale: p.locale,
    week_starts_on: p.week_starts_on,
    date_format: p.date_format,
  };
}

function initials(nombre: string | null | undefined, apellidos: string | null | undefined) {
  const a = (nombre ?? "").trim();
  const b = (apellidos ?? "").trim();
  const first = a ? a[0] : "";
  const second = b ? b[0] : a.split(" ")[1]?.[0] ?? "";
  const out = `${first}${second}`.toUpperCase();
  return out || "·";
}

function MiCuentaPage() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery<Profile>({
    queryKey: ["profile", "me"],
    queryFn: ensureCurrentProfile,
    retry: 1,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (profile && !form) setForm(profileToForm(profile));
  }, [profile, form]);

  const mutation = useMutation({
    mutationFn: (patch: ProfilePatch) => updateCurrentProfile(patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile", "me"], updated);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setForm(profileToForm(updated));
      toast.success("Cambios guardados", {
        description: "Tu perfil se actualizó correctamente.",
      });
    },
    onError: (err) => {
      toast.error("No se pudo guardar", {
        description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
      });
    },
  });

  // ---- Avatar ----
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!profile?.avatar_url) {
      setAvatarSrc(null);
      return;
    }
    resolveAvatarUrl(profile.avatar_url).then((url) => {
      if (!cancelled) setAvatarSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.avatar_url]);

  const avatarMutation = useMutation({
    mutationFn: (file: File) => uploadCurrentUserAvatar(file),
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile", "me"], updated);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Foto actualizada");
    },
    onError: (err) => {
      const message =
        err instanceof AvatarUploadError
          ? err.message
          : "No pudimos subir la foto. Intenta nuevamente.";
      toast.error(message);
    },
  });

  function handlePickFile() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset immediately so seleccionar el mismo archivo dos veces vuelva a disparar el evento.
    e.target.value = "";
    if (!file) return;
    avatarMutation.mutate(file);
  }

  const isDirty = useMemo(() => {
    if (!profile || !form) return false;
    const base = profileToForm(profile);
    return (Object.keys(form) as (keyof FormState)[]).some((k) => form[k] !== base[k]);
  }, [profile, form]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleSave() {
    if (!form) return;
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      const next: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast.error("Revisa los campos marcados");
      return;
    }
    const patch: ProfilePatch = {
      nombre: parsed.data.nombre,
      apellidos: parsed.data.apellidos ? parsed.data.apellidos : null,
      email: parsed.data.email,
      timezone: parsed.data.timezone,
      locale: parsed.data.locale,
      week_starts_on: parsed.data.week_starts_on,
      date_format: parsed.data.date_format,
    };
    mutation.mutate(patch);
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-slate-700">
          No pudimos preparar tu perfil. Intenta cerrar sesión e ingresar nuevamente.
        </p>
      </div>
    );
  }

  if (isLoading || !profile || !form) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Cargando tu perfil…
      </div>
    );
  }

  const displayName = [form.nombre, form.apellidos].filter(Boolean).join(" ") || "Sin nombre";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 pb-32 md:pb-16 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          Mi Cuenta
        </h1>
        <p className="text-sm text-slate-500">
          Tu información personal y tus preferencias.
        </p>
      </header>
      {/* Micro-pregunta discreta (sólo aparece si el gate lo permite) */}
      <MicroSurveyPrompt placement="mi_cuenta" />

      {/* 1. Foto de perfil */}
      <Section title="Foto de perfil">
        <div className="flex items-center gap-5">
          <Avatar className="h-20 w-20 border border-slate-200">
            {avatarSrc ? (
              <AvatarImage src={avatarSrc} alt={displayName} />
            ) : null}
            <AvatarFallback className="bg-indigo-50 text-indigo-700 text-lg font-medium">
              {initials(form.nombre, form.apellidos)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-900">{displayName}</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePickFile}
              disabled={avatarMutation.isPending}
              className="gap-2"
            >
              {avatarMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Subiendo…
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  Cambiar foto
                </>
              )}
            </Button>
            <p className="text-xs text-slate-500">JPG, PNG o WEBP. Máx 2 MB.</p>
          </div>
        </div>
      </Section>

      {/* 2. Información personal */}
      <Section title="Información personal">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="nombre" error={errors.nombre} required>
            <Input
              id="nombre"
              value={form.nombre}
              onChange={(e) => update("nombre", e.target.value)}
              maxLength={80}
              placeholder="Tu nombre"
            />
          </Field>
          <Field label="Apellidos" htmlFor="apellidos" error={errors.apellidos}>
            <Input
              id="apellidos"
              value={form.apellidos}
              onChange={(e) => update("apellidos", e.target.value)}
              maxLength={120}
              placeholder="Tus apellidos"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Correo electrónico" htmlFor="email" error={errors.email} required>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                maxLength={255}
                placeholder="tu@correo.com"
              />
            </Field>
          </div>
        </div>
      </Section>

      {/* 3. Preferencias personales */}
      <Section title="Preferencias personales">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Zona horaria" htmlFor="timezone">
            <Select value={form.timezone} onValueChange={(v) => update("timezone", v)}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Idioma" htmlFor="locale">
            <Select value={form.locale} onValueChange={(v) => update("locale", v)}>
              <SelectTrigger id="locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Primer día de la semana" htmlFor="week_starts_on">
            <Select
              value={String(form.week_starts_on)}
              onValueChange={(v) => update("week_starts_on", Number(v) as 0 | 1)}
            >
              <SelectTrigger id="week_starts_on">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Lunes</SelectItem>
                <SelectItem value="0">Domingo</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Formato de fecha" htmlFor="date_format">
            <Select value={form.date_format} onValueChange={(v) => update("date_format", v)}>
              <SelectTrigger id="date_format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      {/* 4. Información de la cuenta */}
      <Section title="Información de la cuenta">
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <ReadOnlyRow label="Fecha de creación" value={formatDate(profile.created_at)} />
          <ReadOnlyRow label="Última actualización" value={formatDate(profile.updated_at)} />
          <ReadOnlyRow label="Versión de CalmApp" value={CALMAPP_VERSION} />
        </dl>
      </Section>

      {/* 5. Sesión */}
      <Section title="Sesión">
        <SignOutButton />
      </Section>


      {/* Guardar */}
      <div className="sticky bottom-4 md:static flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!isDirty || mutation.isPending}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 md:p-6 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-slate-700">
        {label}
        {required ? <span className="text-indigo-600"> *</span> : null}
      </Label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function SignOutButton() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await queryClient.cancelQueries();
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <p className="text-sm text-slate-600">
        Al cerrar sesión volverás a la pantalla de inicio.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={handleSignOut}
        disabled={loading}
        className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        Cerrar sesión
      </Button>
    </div>
  );
}

