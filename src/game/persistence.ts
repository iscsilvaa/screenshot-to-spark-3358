import { snapshot } from "./store";

/**
 * Save adapter. The local implementation uses localStorage; swap it for a
 * Lovable Cloud implementation (same interface) to sync across devices.
 */
export interface SaveAdapter {
  load(): Promise<ReturnType<typeof snapshot> | null>;
  save(data: ReturnType<typeof snapshot>): Promise<void>;
}

const KEY = "ilha-viva-save-v1";
export const localAdapter: SaveAdapter = {
  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  async save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  },
};
