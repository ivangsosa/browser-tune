export type ProfileId = "balanced" | "low-resource" | "privacy" | "custom";

export interface ExtensionSettings {
  schemaVersion: 1;
  profile: ProfileId;
  blocking: {
    enabled: boolean;
    enabledRulesets: string[];
    blockedDomains: string[];
    excludedDomains: string[];
  };
  tabDiscard: {
    enabled: boolean;
    inactiveMinutes: number;
    excludedDomains: string[];
  };
}
