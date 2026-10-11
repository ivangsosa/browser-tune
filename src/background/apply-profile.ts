import { desiredDynamicRules } from "../core/rules-engine";
import type { ExtensionSettings } from "../core/types";
import { getCapabilities } from "../platform/capabilities";
import {
  applyDynamicRules,
  applyEnabledRulesets
} from "../platform/network-rules";
import { refreshPauses } from "./pause";
import { ensureAlarm } from "./tab-tracker";

export interface ApplySummary {
  rulesAdded: number;
  rulesRemoved: number;
  rulesetsEnabled: string[];
  rulesetsDisabled: string[];
  /** Capacidades no disponibles en este navegador. */
  unavailable: string[];
}

/**
 * Aplica la configuración completa al navegador de forma idempotente:
 * valida (el caller ya sanitizó), consulta capabilities, genera las reglas
 * deseadas y aplica solo diferencias.
 */
export async function applySettings(
  settings: ExtensionSettings
): Promise<ApplySummary> {
  const caps = getCapabilities();
  const summary: ApplySummary = {
    rulesAdded: 0,
    rulesRemoved: 0,
    rulesetsEnabled: [],
    rulesetsDisabled: [],
    unavailable: []
  };

  if (!caps.dnr) {
    summary.unavailable.push("declarativeNetRequest");
    return summary;
  }

  const desired = desiredDynamicRules(settings);
  const applied = await applyDynamicRules(desired);
  summary.rulesAdded = applied.added;
  summary.rulesRemoved = applied.removed;

  await refreshPauses();

  const wantedRulesets = settings.blocking.enabled
    ? settings.blocking.enabledRulesets
    : [];
  const rs = await applyEnabledRulesets(wantedRulesets);
  summary.rulesetsEnabled = rs.enabled;
  summary.rulesetsDisabled = rs.disabled;

  if (settings.tabDiscard.enabled && !(caps.tabDiscard && caps.alarms)) {
    summary.unavailable.push("tabDiscard");
  }
  await ensureAlarm(settings);

  return summary;
}
