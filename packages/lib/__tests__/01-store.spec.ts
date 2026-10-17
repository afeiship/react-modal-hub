import { ModalHubStore } from '../src/store';

describe('ModalHubStore state', () => {
  let hub: ModalHubStore;

  beforeEach(() => {
    hub = new ModalHubStore();
  });

  it('returns default snapshot for unknown name', () => {
    expect(hub.get('login')).toEqual({ visible: false, data: null });
  });

  it('commits state synchronously on show', async () => {
    const p = hub.show('login', { from: 'header' });
    expect(hub.get('login')).toEqual({ visible: true, data: { from: 'header' } });
    await p;
  });

  it('defaults data to null when show omits data', async () => {
    await hub.show('login');
    expect(hub.get('login')).toEqual({ visible: true, data: null });
  });

  it('resets data to {} on hide', async () => {
    await hub.show('login', { from: 'header' });
    await hub.hide('login');
    expect(hub.get('login')).toEqual({ visible: false, data: {} });
  });

  it('hideAll closes every known name', async () => {
    await hub.show('a');
    await hub.show('b');
    await hub.hideAll();
    expect(hub.get('a').visible).toBe(false);
    expect(hub.get('b').visible).toBe(false);
  });

  it('notifies subscribers on change and supports unsubscribe', async () => {
    let calls = 0;
    const unsubscribe = hub.subscribe(() => calls++);
    await hub.show('a');
    expect(calls).toBe(1);
    unsubscribe();
    await hub.hide('a');
    expect(calls).toBe(1);
  });

  it('keeps snapshot reference stable until next change', async () => {
    const s1 = hub.getSnapshot();
    expect(hub.getSnapshot()).toBe(s1);
    await hub.show('a');
    const s2 = hub.getSnapshot();
    expect(s2).not.toBe(s1);
    await hub.show('b');
    // other name's change must not replace a's snapshot object
    expect(hub.getSnapshot().modals.a).toBe(s2.modals.a);
  });
});
