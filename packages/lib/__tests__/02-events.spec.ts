import { ModalHubStore } from '../src/store';
import { vi } from 'vitest';

describe('ModalHubStore events', () => {
  let hub: ModalHubStore;

  beforeEach(() => {
    hub = new ModalHubStore();
  });

  it('emits {name}:show with data after state commit', async () => {
    const seen: any[] = [];
    hub.on('login:show', (data) => seen.push({ data, visible: hub.get('login').visible }));
    await hub.show('login', { from: 'header' });
    expect(seen).toEqual([{ data: { from: 'header' }, visible: true }]);
  });

  it('resolves show after emit', async () => {
    const order: string[] = [];
    hub.on('login:show', () => order.push('emit'));
    await hub.show('login').then(() => order.push('resolve'));
    expect(order).toEqual(['emit', 'resolve']);
  });

  it('emits {name}:hide on visible -> hidden transition only', async () => {
    const order: string[] = [];
    hub.on('login:hide', () => order.push('hide'));

    await hub.hide('login'); // unknown name -> no emit
    await hub.show('login');
    await hub.hide('login'); // transition -> emit
    await hub.hide('login'); // already hidden -> no emit
    expect(order).toEqual(['hide']);
  });

  it('re-emits show when showing an already visible name', async () => {
    const data: any[] = [];
    hub.on('login:show', (d) => data.push(d));
    await hub.show('login', 1);
    await hub.show('login', 2);
    expect(data).toEqual([1, 2]);
    expect(hub.get('login').data).toBe(2);
  });

  it('on returns a subscription that can destroy', async () => {
    let count = 0;
    const sub = hub.on('login:show', () => count++);
    await hub.show('login');
    expect(count).toBe(1);
    sub.destroy();
    await hub.hide('login');
    await hub.show('login');
    expect(count).toBe(1);
  });

  it('destroy is idempotent', async () => {
    let count = 0;
    const sub = hub.on('login:show', () => count++);
    sub.destroy();
    sub.destroy();
    await hub.show('login');
    expect(count).toBe(0);
  });

  it('destroying one listener leaves others working', async () => {
    const calls: string[] = [];
    const first = hub.on('login:show', () => calls.push('first'));
    hub.on('login:show', () => calls.push('second'));

    first.destroy();
    await hub.show('login');
    expect(calls).toEqual(['second']);
  });

  it('a listener destroying itself during invocation does not break iteration', async () => {
    const calls: string[] = [];
    const self = hub.on('login:show', () => {
      calls.push('self');
      self.destroy();
    });
    hub.on('login:show', () => calls.push('after'));

    await hub.show('login');
    expect(calls).toEqual(['self', 'after']);
  });

  it('a throwing listener does not prevent later listeners or reject show()', async () => {
    const calls: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    hub.on('login:show', () => {
      throw new Error('boom');
    });
    hub.on('login:show', () => calls.push('after'));

    await expect(hub.show('login')).resolves.toBeUndefined();
    expect(calls).toEqual(['after']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('removes the event key when the last listener is destroyed', async () => {
    const sub = hub.on('login:show', () => {});
    sub.destroy();
    const events = (hub as unknown as { events: Map<string, Set<unknown>> }).events;
    expect(events.has('login:show')).toBe(false);

    // destroying again must not resurrect or corrupt the map
    sub.destroy();
    expect(events.has('login:show')).toBe(false);
  });

  it('destroying a stale subscription does not delete a newer listener set', async () => {
    const calls: string[] = [];
    const stale = hub.on('login:show', () => calls.push('stale'));
    stale.destroy();
    stale.destroy();

    hub.on('login:show', () => calls.push('fresh'));
    stale.destroy(); // stale handle must not remove the new set

    await hub.show('login');
    expect(calls).toEqual(['fresh']);
  });
});
