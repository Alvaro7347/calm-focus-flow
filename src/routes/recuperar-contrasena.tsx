import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { humanizeAuthError } from "@/lib/authErrors";

export const Route = createFileRoute("/recuperar-contrasena")({
  head: () => ({
    meta: [
      { title: "Recuperar contraseña — CalmApp" },
      { name: "description", content: "Recupera el acceso a tu cuenta de CalmApp." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecuperarPage,
});

const schema = z.object({ email: z.string().trim().email("El correo no es válido").max(255) });

function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Correo inválido");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined,
    });
    setLoading(false);
    if (err) {
      setError(humanizeAuthError(err));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthLayout
        title="Revisa tu correo"
        subtitle="Si el correo existe, te enviamos un enlace para restablecer tu contraseña."
        footer={
          <Link to="/login" className="text-indigo-600 font-medium hover:underline">
            Volver a iniciar sesión
          </Link>
        }
      >
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-sm text-slate-700">
            Enviamos un correo a <span className="font-medium">{email}</span>.
          </p>
          <p className="text-xs text-slate-500">Revisa también spam o correo no deseado.</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Recuperar contraseña"
      subtitle="Ingresa tu correo y te enviaremos un enlace para restablecerla."
      footer={
        <Link to="/login" className="text-indigo-600 font-medium hover:underline">
          Volver a iniciar sesión
        </Link>
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
        </div>

        {error ? (
          <div className="rounded-md bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Enviar enlace
        </Button>
      </form>
    </AuthLayout>
  );
}
