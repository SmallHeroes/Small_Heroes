type ChildIdentity = { name: string; gender: 'boy' | 'girl' };
type HandoffStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
declare const handoff: {
  KEY: string;
  LEGACY_KEY: string;
  TTL_MS: number;
  MAX_NAME: number;
  save(storage: HandoffStorage, child: ChildIdentity, now?: number): boolean;
  load(storage: HandoffStorage, now?: number): ChildIdentity | null;
  applyToWizard(storage: HandoffStorage, state: { childName?: unknown; childGender?: unknown }, now?: number): boolean;
  retireLegacy(storage: HandoffStorage): void;
};
export = handoff;
