/**
 * Registro de acciones de la extensión (transparencia: qué hizo y cuándo).
 * Tipos de actividad, sin APIs de navegador.
 */
export interface ActivityEntry {
  ts: number;
  kind:
    | "apply" // configuración aplicada: reglas +N/−N
    | "profile" // perfil plantilla aplicado
    | "import" // importación aplicada
    | "pause" // bloqueo pausado en un dominio
    | "resume" // bloqueo reanudado en un dominio
    | "discard" // pestañas descartadas
    | "error"; // fallo al aplicar
  /** Parámetros según kind; todos opcionales. */
  domain?: string;
  until?: number;
  count?: number;
  added?: number;
  removed?: number;
  profile?: string;
  error?: string;
}

export const MAX_ACTIVITY = 50;

/** Agrega una entrada al tope y descarta las más viejas (FIFO acotado). */
export function appendActivity(
  log: ActivityEntry[],
  entry: Omit<ActivityEntry, "ts">,
  now = Date.now()
): ActivityEntry[] {
  return [{ ...entry, ts: now }, ...log].slice(0, MAX_ACTIVITY);
}
