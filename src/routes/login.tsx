import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { humanizeAuthError } from "@/lib/authErrors";
import { ensureCurrentProfile } from "@/services/profileService";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — CalmApp" },
      { name: "description", content: "Accede a tu cuenta de CalmApp." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("El correo no es válido").max(255),
  password: z.string().min(1, "Ingresa tu contraseña").max(200),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const i of parsed.error.issues) next[i.path[0] as "email" | "password"] = i.message;
      setErrors(next);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);
    if (error) {
      setErrors({ form: humanizeAuthError(error) });
      return;
    }
    navigate({ to: "/foco", replace: true });
  }

  return (
    <AuthLayout
      title="Bienvenido otra vez"
      subtitle="Inicia sesión para continuar organizando tu día con calma."
      footer={
        <>
          ¿Aún no tienes cuenta?{" "}
          <Link to="/registro" className="text-indigo-600 font-medium hover:underline">
            Crear cuenta
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link
              to="/recuperar-contrasena"
              className="text-xs text-indigo-600 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            disabled={loading}
          />
          {errors.password ? <p className="text-xs text-red-600">{errors.password}</p> : null}
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
          Iniciar sesión
        </Button>
      </form>
    </AuthLayout>
  );
}
