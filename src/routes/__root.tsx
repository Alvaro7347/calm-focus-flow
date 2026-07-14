import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

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
import { BootstrapProvider } from "../lib/bootstrapContext";
import { AREAS_NAV_QUERY_KEY } from "../hooks/useAreasNav";
import { invalidateActivityGraph } from "../lib/queryInvalidation";
import { supabase } from "../integrations/supabase/client";

// Rutas visibles sin sesión (auth + legales).
const PUBLIC_PREFIXES = [
  "/login",
  "/registro",
  "/recuperar-contrasena",
  "/reset-password",
  "/legal",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname === p);
}

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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#ffffff" },
      { title: `${BRAND.name} — ${BRAND.tagline}` },
      { name: "description", content: BRAND.description },
      { name: "author", content: BRAND.name },
      { name: "application-name", content: BRAND.name },
      { name: "apple-mobile-web-app-title", content: BRAND.name },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { property: "og:title", content: `${BRAND.name} — ${BRAND.tagline}` },
      { property: "og:description", content: BRAND.slogan },
      { property: "og:site_name", content: BRAND.name },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `${BRAND.name} — ${BRAND.tagline}` },
      { name: "twitter:description", content: BRAND.slogan },
      { name: "twitter:image", content: "/og-image.jpg" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-icon", sizes: "152x152", href: "/icons/icon-152x152.png" },
      { rel: "apple-touch-icon", sizes: "144x144", href: "/icons/icon-144x144.png" },
      { rel: "apple-touch-icon", sizes: "120x120", href: "/icons/icon-152x152.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
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

type AuthStatus = "loading" | "authenticated" | "anonymous";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");

  // Hidratación inicial de sesión + suscripción a cambios.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Modo desarrollo opcional: solo si VITE_ENABLE_DEV_SESSION=1.
      // Nunca en producción. Ver src/lib/devAuth.ts.
      if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_SESSION === "1") {
        try {
          const { ensureDevSession } = await import("@/lib/devAuth");
          await ensureDevSession();
        } catch (err) {
          console.warn("[devAuth] no se pudo iniciar sesión de dev:", err);
        }
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setAuthStatus(data.session ? "authenticated" : "anonymous");
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED" && event !== "INITIAL_SESSION") return;
      setAuthStatus(session ? "authenticated" : "anonymous");
      if (event === "SIGNED_OUT") {
        queryClient.clear();
      } else if (event === "SIGNED_IN") {
        invalidateActivityGraph(queryClient);
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  // Deep-link desde el Service Worker: cuando el usuario toca una
  // notificación push y la app ya estaba abierta, el SW envía
  // `calmapp:navigate` con la URL destino. Navegamos in-app sin recargar
  // para no descartar los search params (p. ej. ?event=<id>).
  // El ícono de la home screen NO dispara este mensaje: sigue entrando
  // por la ruta por defecto.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "calmapp:navigate" || typeof data.to !== "string") return;
      try {
        const url = new URL(data.to, window.location.origin);
        if (url.origin !== window.location.origin) return;
        // `to` debe ser sólo el pathname; el search se pasa como objeto
        // para que TanStack Router lo parsee y `Route.useSearch()` lo
        // reciba (necesario para abrir el detalle vía ?event=<id>).
        const search: Record<string, string> = {};
        url.searchParams.forEach((v, k) => {
          search[k] = v;
        });
        navigate({
          to: url.pathname as string,
          search: search as never,
          replace: false,
        });
      } catch {
        /* ignore */
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);

  // Enforcement de rutas: si no hay sesión y la ruta no es pública → /login.
  // Si hay sesión y está en una pantalla de auth → /foco.
  useEffect(() => {
    if (authStatus === "loading") return;
    const publicRoute = isPublicPath(pathname);
    if (authStatus === "anonymous" && !publicRoute) {
      navigate({ to: "/login", replace: true });
    } else if (authStatus === "authenticated" && (pathname === "/login" || pathname === "/registro" || pathname === "/recuperar-contrasena")) {
      navigate({ to: "/foco", replace: true });
    }
  }, [authStatus, pathname, navigate]);

  const publicRoute = isPublicPath(pathname);

  // Pantallas públicas: layout limpio sin chrome de la app.
  if (publicRoute) {
    return (
      <QueryClientProvider client={queryClient}>
        <BootstrapProvider value={{ bootstrapped: true, bootstrapError: null }}>
          <Outlet />
        </BootstrapProvider>
      </QueryClientProvider>
    );
  }

  // Ruta protegida: mostramos splash hasta resolver sesión / redirect.
  const ready = authStatus === "authenticated";

  return (
    <QueryClientProvider client={queryClient}>
      <BootstrapProvider value={{ bootstrapped: ready, bootstrapError: null }}>
        <div className="flex min-h-screen bg-background font-sans text-foreground">
          {ready ? <Sidebar /> : null}
          {ready ? <AreasDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} /> : null}
          <div className="flex-1 flex flex-col min-w-0">
            {ready ? <MobileHeader onOpenDrawer={() => setDrawerOpen(true)} /> : null}
            {ready ? <TopBar /> : null}
            <main className="flex-1 pb-20 md:pb-0">
              {ready ? <Outlet /> : <SplashScreen />}
            </main>
          </div>
          {ready ? <MobileFab /> : null}
          {ready ? <MobileTabBar /> : null}
        </div>
      </BootstrapProvider>
    </QueryClientProvider>
  );
}
