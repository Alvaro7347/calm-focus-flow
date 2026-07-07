import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { humanizeAuthError } from "@/lib/authErrors";

export const Route = createFileRoute("/registro")({
  head: () => ({
    meta: [
      { title: "Crear cuenta — CalmApp" },
      { name: "description", content: "Crea tu cuenta en CalmApp." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegistroPage,
});

const schema = z
  .object({
    nombre: z.string().trim().min(1, "Ingresa tu nombre").max(80),
    email: z.string().trim().email("El correo no es válido").max(255),
    password: z.string().min(8, "Mínimo 8 caracteres").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden",
  });

type Errs = Partial<Record<"nombre" | "email" | "password" | "confirm" | "form", string>>;

function RegistroPage() {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errs>({});
  const [loading, setLoading] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({ nombre, email, password, confirm });
    if (!parsed.success) {
      const next: Errs = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0] as keyof Errs;
        if (!next[k]) next[k] = i.message;
      }
      setErrors(next);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { full_name: parsed.data.nombre },
      },
    });
    setLoading(false);
    if (error) {
      setErrors({ form: humanizeAuthError(error) });
      return;
    }
    // Si Supabase Auth exige confirmación por email, session viene null.
    if (!data.session) {
      setSentConfirmation(true);
      return;
    }
    navigate({ to: "/foco", replace: true });
  }

  if (sentConfirmation) {
    return (
      <AuthLayout
        title="Revisa tu correo"
        subtitle="Te enviamos un enlace para confirmar tu cuenta."
        footer={
          <>
            ¿Ya la confirmaste?{" "}
            <Link to="/login" className="text-indigo-600 font-medium hover:underline">
              Iniciar sesión
            </Link>
          </>
        }
      >
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-sm text-slate-700">
            Enviamos un correo a <span className="font-medium">{email}</span>. Sigue las
            instrucciones para activar tu cuenta.
          </p>
          <p className="text-xs text-slate-500">
            Si no lo ves, revisa spam o correo no deseado.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Empieza a organizar tu día con calma."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-indigo-600 font-medium hover:underline">
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            autoComplete="given-name"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Tu nombre"
            disabled={loading}
          />
          {errors.nombre ? <p className="text-xs text-red-600">{errors.nombre}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            disabled={loading}
          />
          {errors.email ? <p className="text-xs text-red-600">{errors.email}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            disabled={loading}
          />
          {errors.password ? <p className="text-xs text-red-600">{errors.password}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Repetir contraseña</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repite la contraseña"
            disabled={loading}
          />
          {errors.confirm ? <p className="text-xs text-red-600">{errors.confirm}</p> : null}
        </div>

        {errors.form ? (
          <div className="rounded-md bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
            {errors.form}
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Crear cuenta
        </Button>
      </form>
    </AuthLayout>
  );
}
