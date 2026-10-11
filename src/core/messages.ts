import type { ExtensionSettings, ProfileId } from "./types";

/** Mensajes UI -> background. La UI nunca toca APIs del navegador directamente. */
export type BgRequest =
  | { type: "getState" }
  | { type: "setProfile"; profile: ProfileId }
  | { type: "saveSettings"; settings: ExtensionSettings }
  | { type: "importSettings"; json: string };

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
}

export interface ApplyResponse {
  ok: boolean;
  settings?: ExtensionSettings;
  summary?: ApplySummaryInfo;
  error?: string;
}

export type BgResponse = StateResponse | ApplyResponse;
