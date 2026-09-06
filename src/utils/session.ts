// A login (including a new login by the same user) owns all private async work.
// Refresh rotation keeps this generation; logout/account changes replace it.
let generation = 0;
let controller = new AbortController();
let synchronize = () => {};
const listeners = new Set<() => void>();
const resultOwners = new WeakMap<object, { owner: number; valid?: () => boolean }>();

export class SessionChangedError extends Error {
  constructor() {
    super('The authentication session changed');
    this.name = 'SessionChangedError';
  }
}

export function setSessionSynchronizer(callback: () => void): void {
  synchronize = callback;
}

export function getSessionGeneration(): number {
  synchronize();
  return generation;
}

export function isCurrentSession(owner: number): boolean {
  return getSessionGeneration() === owner;
}

export function assertCurrentSession(owner: number): void {
  if (!isCurrentSession(owner)) throw new SessionChangedError();
}

export function getSessionSignal(): AbortSignal {
  synchronize();
  return controller.signal;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function advanceSession(): void {
  generation++;
  const previous = controller;
  controller = new AbortController();
  previous.abort();
  listeners.forEach((listener) => listener());
}

export function ownSessionResult<T>(value: T, owner: number, valid?: () => boolean): T {
  if (value && typeof value === 'object') resultOwners.set(value, { owner, valid });
  return value;
}

export function assertSessionResult(value: object): void {
  const source = resultOwners.get(value);
  if (source) {
    assertCurrentSession(source.owner);
    if (source.valid && !source.valid()) throw new SessionChangedError();
  }
}
