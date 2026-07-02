import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Sidebar } from "../components/layout/Sidebar";
import { TopBar } from "../components/layout/TopBar";
import { MobileHeader } from "../components/layout/MobileHeader";
import { MobileTabBar } from "../components/layout/MobileTabBar";
import { MobileFab } from "../components/layout/MobileFab";
import { AreasDrawer } from "../components/layout/AreasDrawer";
import { LogoSymbol } from "../components/brand/LogoSymbol";
import { SplashScreen } from "../components/brand/SplashScreen";
import { BRAND } from "../brand/brand";
import { useState } from "react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center flex flex-col items-center">
        <LogoSymbol size={96} opacity={0.9} ariaHidden />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-foreground">
          Este espacio aún no existe
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          La página que buscas no está aquí. Respira, y volvamos al inicio.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Volver al inicio
          </Link>
        </div>
        <p className="mt-8 text-[11px] uppercase tracking-widest text-muted-foreground/60">
          {BRAND.name}
        </p>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CalmApp — Tu espacio de claridad" },
      {
        name: "description",
        content:
          "CalmApp es tu espacio de claridad: una app personal para gestionar tareas y reducir la carga mental, no para exigir más productividad.",
      },
      { name: "author", content: "CalmApp" },
      { property: "og:title", content: "CalmApp — Tu espacio de claridad" },
      {
        property: "og:description",
        content:
          "Organiza tus tareas con calma. CalmApp te ayuda a reducir la carga mental, no a acumular urgencias.",
      },
      { property: "og:site_name", content: "CalmApp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "CalmApp — Tu espacio de claridad" },
      {
        name: "twitter:description",
        content:
          "Organiza tus tareas con calma. CalmApp te ayuda a reducir la carga mental, no a acumular urgencias.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Modo de desarrollo MVP1: garantiza una sesión activa sin pantalla de Login.
        // Ver src/lib/devAuth.ts para instrucciones de eliminación cuando exista Login real.
        const { ensureDevSession } = await import("@/lib/devAuth");
        const { seedIfEmpty } = await import("@/services/seedService");
        await ensureDevSession();
        await seedIfEmpty();
        if (!cancelled) setBootstrapped(true);
      } catch (err) {
        console.error("[bootstrap] error", err);
        if (!cancelled) {
          setBootstrapError(err instanceof Error ? err.message : "Error al inicializar la sesión");
          setBootstrapped(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen bg-background font-sans text-foreground">
        <Sidebar />
        <AreasDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <MobileHeader onOpenDrawer={() => setDrawerOpen(true)} />
          <TopBar />
          <main className="flex-1 pb-20 md:pb-0">
            {!bootstrapped ? (
              <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
                Preparando tu espacio…
              </div>
            ) : bootstrapError ? (
              <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-sm text-destructive">
                {bootstrapError}
              </div>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
        <MobileFab />
        <MobileTabBar />
      </div>
    </QueryClientProvider>
  );
}
