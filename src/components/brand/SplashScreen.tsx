/**
 * ========================================================
 * Componente: SplashScreen
 *
 * Pantalla de bienvenida elegante mostrada durante el
 * bootstrap de la app. Fondo blanco, logo centrado, un
 * mensaje sutil. Sin animaciones complejas: el objetivo es
 * transmitir calma.
 * ========================================================
 */
import { Logo } from "@/components/brand/Logo";
import { BRAND } from "@/brand/brand";

export function SplashScreen({ message = "Preparando tu espacio…" }: { message?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Logo height={64} className="animate-[fadeIn_600ms_ease-out]" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <span className="sr-only">{BRAND.name}</span>
    </div>
  );
}
