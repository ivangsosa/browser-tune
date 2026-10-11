export type ProfileId = "balanced" | "low-resource" | "privacy" | "custom";

export interface BlockingSettings {
  enabled: boolean;
  /** IDs de rulesets estáticos predefinidos activos. */
  enabledRulesets: string[];
  /** Dominios del usuario -> dynamic rules (block). Cap de diseño: 5.000 (límite Firefox). */
  blockedDomains: string[];
  /** Dominios excluidos del bloqueo -> reglas allow (preceden a block por la API). */
  excludedDomains: string[];
}

export interface TabDiscardSettings {
  enabled: boolean;
  /** Minutos de inactividad antes de descartar. Rango válido: 5–1440. */
  inactiveMinutes: number;
  /** Dominios cuyas pestañas nunca se descartan. */
  excludedDomains: string[];
}

export interface ExtensionSettings {
  schemaVersion: 1;
  profile: ProfileId;
  blocking: BlockingSettings;
  tabDiscard: TabDiscardSettings;
}

/** Plantilla que un perfil estampa sobre la configuración. */
export interface ProfileTemplate {
  blocking: BlockingSettings;
  tabDiscard: TabDiscardSettings;
}
