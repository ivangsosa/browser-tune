import type { ExtensionSettings, PauseEntry, ProfileId } from "./types";

/** Mensajes UI -> background. La UI nunca toca APIs del navegador directamente. */
export type BgRequest =
  | { type: "getState" }
  | { type: "setProfile"; profile: ProfileId }
  | { type: "saveSettings"; settings: ExtensionSettings }
  | { type: "importSettings"; json: string }
  | { type: "reapply" }
  | { type: "excludeSite"; scope: "blocking" | "discard"; domain: string }
  | { type: "pauseSite"; domain: string; minutes: number }
  | { type: "resumeSite"; domain: string }
  | { type: "discardNow" };

export interface CapabilitiesInfo {
  dnr: boolean;
  tabDiscard: boolean;
  alarms: boolean;
  sessionStorage: boolean;
  isFirefox: boolean;
}

export interface ApplySummaryInfo {
  rulesAdded: number;
  rulesRemoved: number;
  rulesetsEnabled: string[];
  rulesetsDisabled: string[];
  unavailable: string[];
}

export interface StateResponse {
  settings: ExtensionSettings;
  derivedProfile: ProfileId;
  capabilities: CapabilitiesInfo;
  /** Reglas dinámicas actualmente administradas por la extensión. */
  managedRuleCount: number;
  /** Pausas de bloqueo vigentes. */
  pauses: PauseEntry[];
  /** Pestañas actualmente descartadas en el navegador. */
  discardedTabs: number;
  /** Último error al aplicar la configuración (null si el último intento fue OK). */
  lastError: string | null;
}

export interface ApplyResponse {
  ok: boolean;
  settings?: ExtensionSettings;
  summary?: ApplySummaryInfo;
  error?: string;
  /** Solo para discardNow: pestañas descartadas en esta acción. */
  discarded?: number;
}

export type BgResponse = StateResponse | ApplyResponse;
