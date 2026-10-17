import { ModalHubStore } from '../src/store';

describe('ModalHubStore.when', () => {
  let hub: ModalHubStore;

  beforeEach(() => {
    hub = new ModalHubStore();
  });

  it('resolves after the name is hidden', async () => {
    await hub.show('login');
    const w = hub.when('login');
    let resolved = false;
    w.then(() => (resolved = true));
    await hub.hide('login');
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  it('stops resolving after destroy()', async () => {
    await hub.show('login');
    const w = hub.when('login');
    w.destroy();
    let resolved = false;
    w.then(() => (resolved = true));
    await hub.hide('login');
    await Promise.resolve();
    expect(resolved).toBe(false);
  });

  it('still resolves when destroy is called after firing', async () => {
    await hub.show('login');
    const w = hub.when('login');
    let resolved = false;
    w.then(() => (resolved = true));
    await hub.hide('login');
    await Promise.resolve();
    w.destroy(); // no throw, already resolved
    expect(resolved).toBe(true);
  });
});
