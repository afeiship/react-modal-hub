import { afterEach, expect, it, vi } from 'vitest';

describe('nx.$modal attach', () => {
  afterEach(() => {
    delete (globalThis as any).nx;
    vi.resetModules();
  });

  it('attaches modalHub to nx.$modal on import when nx exists', async () => {
    (globalThis as any).nx = {};
    vi.resetModules();
    const { modalHub } = await import('../src/store');
    expect((globalThis as any).nx.$modal).toBe(modalHub);
  });

  it('skips silently when nx is absent', async () => {
    delete (globalThis as any).nx;
    vi.resetModules();
    const mod = await import('../src/store');
    expect(mod.modalHub).toBeDefined();
    expect((globalThis as any).nx).toBeUndefined();
  });
});
