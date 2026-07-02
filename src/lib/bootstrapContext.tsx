/**
 * BootstrapContext
 *
 * Expone el estado del bootstrap inicial (ensureDevSession + seedIfEmpty)
 * a componentes del shell (Sidebar, AreasDrawer) para que difieran sus
 * consultas a Supabase hasta que exista una sesión válida.
 */
import { createContext, useContext, type ReactNode } from "react";

interface BootstrapState {
  bootstrapped: boolean;
  bootstrapError: string | null;
}

const BootstrapContext = createContext<BootstrapState>({
  bootstrapped: false,
  bootstrapError: null,
});

export function BootstrapProvider({
  value,
  children,
}: {
  value: BootstrapState;
  children: ReactNode;
}) {
  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
}

export function useBootstrap(): BootstrapState {
  return useContext(BootstrapContext);
}

export function useBootstrapReady(): boolean {
  const { bootstrapped, bootstrapError } = useContext(BootstrapContext);
  return bootstrapped && !bootstrapError;
}
