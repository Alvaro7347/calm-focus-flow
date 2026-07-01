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
import { useState } from "react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
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
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
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

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
        <Sidebar />
        <AreasDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <MobileHeader onOpenDrawer={() => setDrawerOpen(true)} />
          <TopBar />
          <main className="flex-1 pb-20 md:pb-0">
            <Outlet />
          </main>
        </div>
        <MobileFab />
        <MobileTabBar />
      </div>
    </QueryClientProvider>
  );
}
