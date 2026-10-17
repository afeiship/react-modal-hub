import { ModalHubStore } from '../src/store';

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
});
