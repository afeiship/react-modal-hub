import type { ModalEvent, ModalHubState, ModalSnapshot, Subscription } from './types';

type Listener = () => void;
type EventCallback = (data?: any) => void;

const DEFAULT_SNAPSHOT: ModalSnapshot = Object.freeze({ visible: false, data: null });

export class ModalHubStore {
  private state: ModalHubState = { modals: {} };
  private listeners = new Set<Listener>();
  private events = new Map<string, Set<EventCallback>>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): ModalHubState {
    return this.state;
  }

  get(name: string): ModalSnapshot {
    return this.state.modals[name] || DEFAULT_SNAPSHOT;
  }

  async show(name: string, data?: any) {
    const snapshot: ModalSnapshot = { visible: true, data: data ?? null };
    this.state = { modals: { ...this.state.modals, [name]: snapshot } };
    this.listeners.forEach((listener) => listener());
    await Promise.resolve().then(() => this.emit(`${name}:show`, snapshot.data));
  }

  async hide(name: string) {
    const current = this.state.modals[name];
    if (!current || !current.visible) return;
    const snapshot: ModalSnapshot = { visible: false, data: {} };
    this.state = { modals: { ...this.state.modals, [name]: snapshot } };
    this.listeners.forEach((listener) => listener());
    await Promise.resolve().then(() => this.emit(`${name}:hide`, snapshot.data));
  }

  async hideAll() {
    const names = Object.keys(this.state.modals);
    await Promise.all(names.map((name) => this.hide(name)));
  }

  on(event: ModalEvent, callback: EventCallback): Subscription {
    let set = this.events.get(event);
    if (!set) {
      set = new Set<EventCallback>();
      this.events.set(event, set);
    }
    set.add(callback);
    return {
      destroy: () => {
        if (set.delete(callback) && set.size === 0 && this.events.get(event) === set) {
          this.events.delete(event);
        }
      },
    };
  }

  when(name: string): Promise<void> & Subscription {
    let destroy: () => void = () => {};
    const promise = new Promise<void>((resolve) => {
      const sub = this.on(`${name}:hide`, () => {
        sub.destroy();
        resolve();
      });
      destroy = sub.destroy;
    });
    return Object.assign(promise, { destroy: () => destroy() });
  }

  private emit(event: ModalEvent, data?: any) {
    const set = this.events.get(event);
    if (!set) return;
    Array.from(set).forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        console.error(`[react-modal-hub] Error in listener for "${event}":`, err);
      }
    });
  }
}

declare global {
  interface NxStatic {
    $modal: ModalHubStore;
  }
}

export const modalHub = new ModalHubStore();

const globalRef = globalThis as typeof globalThis & { nx?: NxStatic };
if (globalRef.nx) {
  globalRef.nx.$modal = modalHub;
}
