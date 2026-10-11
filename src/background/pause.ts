import { activePauses, desiredPauseRules, withPause } from "../core/rules-engine";
import type { PauseEntry } from "../core/types";
import { getCapabilities } from "../platform/capabilities";
import { applySessionRules } from "../platform/network-rules";
import { loadPauses, logActivity, savePauses } from "../platform/storage";

const ALARM_NAME = "browser-tune:pause-expiry";

/**
 * Reconstruye todo desde storage: descarta pausas vencidas, aplica las
 * session rules (que no sobreviven a un reinicio del navegador) y arma una
 * alarma puntual para el próximo vencimiento. Idempotente.
 */
export async function refreshPauses(): Promise<PauseEntry[]> {
  const caps = getCapabilities();
  const all = await loadPauses();
  const active = activePauses(all, Date.now());
  if (active.length !== all.length) await savePauses(active);
  if (caps.dnr) await applySessionRules(desiredPauseRules(active));
  if (caps.alarms) {
    if (active.length > 0) {
      const next = Math.min(...active.map((p) => p.until));
      await chrome.alarms.create(ALARM_NAME, { when: next });
    } else {
      await chrome.alarms.clear(ALARM_NAME);
    }
  }
  return active;
}

export async function pauseSite(
  domain: string,
  minutes: number
): Promise<PauseEntry[]> {
  const until = Date.now() + minutes * 60_000;
  await savePauses(withPause(await loadPauses(), domain, until));
  await logActivity({ kind: "pause", domain, until });
  return refreshPauses();
}

export async function resumeSite(domain: string): Promise<PauseEntry[]> {
  await savePauses((await loadPauses()).filter((p) => p.domain !== domain));
  await logActivity({ kind: "resume", domain });
  return refreshPauses();
}

/** Registrar en el top-level del background (los listeners mueren con el SW). */
export function initPauseExpiry(): void {
  if (!getCapabilities().alarms) return;
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) void refreshPauses();
  });
}
