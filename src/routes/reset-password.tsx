import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { humanizeAuthError } from "@/lib/authErrors";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña — CalmApp" },
      { name: "description", content: "Definí una nueva contraseña para tu cuenta." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden",
  });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"password" | "confirm" | "form", string>>>({});
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase entrega sesión de recovery vía hash tras hacer clic en el link.
    // onAuthStateChange dispara PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0] as "password" | "confirm";
        if (!next[k]) next[k] = i.message;
      }
      setErrors(next);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);
    if (error) {
      setErrors({ form: humanizeAuthError(error) });
      return;
    }
    navigate({ to: "/foco", replace: true });
  }

  return (
    <AuthLayout
      title="Nueva contraseña"
      subtitle="Elegí una contraseña que solo vos conozcas."
      footer={
        <Link to="/login" className="text-indigo-600 font-medium hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      {!ready ? (
        <div className="flex items-center justify-center py-6 text-sm text-slate-500 gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Verificando enlace…
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
            Guardar contraseña
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
