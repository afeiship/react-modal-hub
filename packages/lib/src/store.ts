import type { ModalHubState, ModalSnapshot } from './types';

type Listener = () => void;

export class ModalHubStore {
  private state: ModalHubState = { modals: {} };
  private listeners = new Set<Listener>();

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
    return this.state.modals[name] || { visible: false, data: null };
  }

  async show(name: string, data?: any) {
    const snapshot: ModalSnapshot = { visible: true, data: data ?? null };
    this.state = { modals: { ...this.state.modals, [name]: snapshot } };
    this.listeners.forEach((listener) => listener());
  }

  async hide(name: string) {
    const current = this.state.modals[name];
    if (!current || !current.visible) return;
    const snapshot: ModalSnapshot = { visible: false, data: {} };
    this.state = { modals: { ...this.state.modals, [name]: snapshot } };
    this.listeners.forEach((listener) => listener());
  }

  async hideAll() {
    const names = Object.keys(this.state.modals);
    await Promise.all(names.map((name) => this.hide(name)));
  }
}
