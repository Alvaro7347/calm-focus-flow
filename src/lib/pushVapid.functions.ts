/**
 * Server function pública: devuelve la clave pública VAPID.
 * Segura de exponer al cliente (no revela la clave privada).
 */
import { createServerFn } from "@tanstack/react-start";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) throw new Error("VAPID_PUBLIC_KEY not configured");
  return key;
});
