# react-modal-hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@jswork/react-modal-hub` 1.0.0 — a zero-dependency modal orchestrator where a singleton store owns all modal visibility/data, driven from inside components (`useModalHub`) or outside (`nx.$modal`).

**Architecture:** `ModalHubStore` (plain TS class, immutable state, microtask-deferred event emit) + `ModalHub` Provider that mounts registered modal components with per-name `useSyncExternalStore` wrappers (render isolation). Module-level singleton attaches to `globalThis.nx.$modal` on import when `nx` exists.

**Tech Stack:** TS 5, React 18 (peer), vitest + @testing-library/react + jsdom, tsup. Workspace: `packages/lib` only (pnpm).

**Spec:** `docs/superpowers/specs/2026-10-17-react-modal-hub-design.md` — read it before starting if you have no context.

**Working directory for all tasks:** `/Users/afei/github/react-modal-hub/packages/lib`

**Existing baseline:** scaffolded `src/index.tsx` (placeholder class component), `src/style.scss` (empty shell), `__tests__/01-basic.spec.tsx` (tests container `data-component`/`className`/`children` — must keep passing untouched).

---

### Task 1: types.ts + store state core (get/subscribe/show/hide/hideAll)

**Files:**
- Create: `src/types.ts`
- Create: `src/store.ts`
- Test: `__tests__/01-store.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/01-store.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- 01-store`
Expected: FAIL — `Cannot find module '../src/store'` (module doesn't exist yet)

- [ ] **Step 3: Write types.ts**

Create `src/types.ts`:

```ts
import type { ComponentType, HTMLAttributes, ReactNode } from 'react';

export type ModalSnapshot = {
  visible: boolean;
  data: any;
};

export type ModalHubState = {
  modals: Record<string, ModalSnapshot>;
};

export type ModalComponentProps = {
  name: string;
  data: any;
  visible: boolean;
};

export type ModalComponent = ComponentType<ModalComponentProps>;

export type Subscription = {
  destroy: () => void;
};

export type ModalEvent = `${string}:show` | `${string}:hide`;

export type ModalHubProps = {
  /**
   * Modals mounted when ready is true.
   * @default {}
   */
  modals?: Record<string, ModalComponent>;
  /**
   * Modals always mounted regardless of ready.
   * @default {}
   */
  eagerModals?: Record<string, ModalComponent>;
  /**
   * Controls whether modals are mounted.
   * @default true
   */
  ready?: boolean;
  /**
   * The extended className for container.
   * @default ''
   */
  className?: string;
  /**
   * The children element.
   */
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>;
```

- [ ] **Step 4: Write minimal store implementation**

Create `src/store.ts`:

```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- 01-store`
Expected: PASS — 7 tests

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/store.ts __tests__/01-store.spec.ts
git commit -m "feat(lib): add modal store state core with immutable snapshots"
```

---

### Task 2: Event bus (on/destroy) + show/hide emit timing + edge semantics

**Files:**
- Modify: `src/store.ts`
- Test: `__tests__/02-events.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/02-events.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- 02-events`
Expected: FAIL — `hub.on is not a function`

- [ ] **Step 3: Implement event bus + emit**

Replace `src/store.ts` with:

```ts
import type { ModalEvent, ModalHubState, ModalSnapshot, Subscription } from './types';

type Listener = () => void;
type EventCallback = (data?: any) => void;

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
    return this.state.modals[name] || { visible: false, data: null };
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
    const set = this.events.get(event) ?? new Set<EventCallback>();
    this.events.set(event, set);
    set.add(callback);
    return {
      destroy: () => {
        set.delete(callback);
      },
    };
  }

  private emit(event: ModalEvent, data?: any) {
    const set = this.events.get(event);
    if (!set) return;
    [...set].forEach((callback) => callback(data));
  }
}
```

Note: `emit(\`${name}:show\`)` — TS 5 contextually types the template literal against `ModalEvent`; if the compiler complains, type `emit(event: string, ...)` instead (Map is already keyed by `string`). Keep public `on`/`when` signatures as `ModalEvent` for autocomplete.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- 02-events`
Expected: PASS — 6 tests (also confirm `01-store` still passes: `pnpm test`)

- [ ] **Step 5: Commit**

```bash
git add src/store.ts __tests__/02-events.spec.ts
git commit -m "feat(lib): add event bus with destroy subscriptions and microtask emit"
```

---

### Task 3: when() with destroy

**Files:**
- Modify: `src/store.ts`
- Test: `__tests__/03-when.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/03-when.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- 03-when`
Expected: FAIL — `hub.when is not a function`

- [ ] **Step 3: Implement when**

Append to `ModalHubStore` in `src/store.ts` (after `on`, before `emit`):

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- 03-when`
Expected: PASS — 3 tests; full suite `pnpm test` all green

- [ ] **Step 5: Commit**

```bash
git add src/store.ts __tests__/03-when.spec.ts
git commit -m "feat(lib): add when() promise with destroy cancellation"
```

---

### Task 4: nx.$modal global attach

**Files:**
- Modify: `src/store.ts` (bottom of file)
- Test: `__tests__/04-nx.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/04-nx.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- 04-nx`
Expected: FAIL — `nx.$modal` is `undefined` (attach not implemented)

- [ ] **Step 3: Implement the import side effect**

Append to the bottom of `src/store.ts` (after the class):

```ts
declare global {
  interface NxStatic {
    $modal?: ModalHubStore;
  }
}

export const modalHub = new ModalHubStore();

const globalRef = globalThis as typeof globalThis & { nx?: NxStatic };
if (globalRef.nx) {
  globalRef.nx.$modal = modalHub;
}
```

Use `globalThis.nx` (not a bare `nx` identifier) to avoid a duplicate-identifier conflict with `@jswork/next`'s own global declarations, and to skip silently when `nx` is absent.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- 04-nx`
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/store.ts __tests__/04-nx.spec.ts
git commit -m "feat(lib): attach singleton to nx.$modal on import"
```

---

### Task 5: context.ts + useModalHub

**Files:**
- Create: `src/context.ts`
- Test: `__tests__/05-context.spec.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/05-context.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModalHub from '../src';
import { useModalHub } from '../src/context';
import { modalHub } from '../src/store';

const Probe = () => {
  const hub = useModalHub();
  return <span data-testid="hub">{hub === modalHub ? 'same' : 'diff'}</span>;
};

describe('useModalHub', () => {
  it('throws a clear error outside the provider', () => {
    expect(() => render(<Probe />)).toThrow('useModalHub must be used inside <ModalHub>');
  });

  it('returns the singleton instance inside the provider', () => {
    render(
      <ModalHub>
        <Probe />
      </ModalHub>
    );
    expect(screen.getByTestId('hub')).toHaveTextContent('same');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- 05-context`
Expected: FAIL — `Cannot find module '../src/context'`

- [ ] **Step 3: Write context.ts**

Create `src/context.ts`:

```ts
import { createContext, useContext } from 'react';
import type { ModalHubStore } from './store';

export const ModalContext = createContext<ModalHubStore | null>(null);

export const useModalHub = (): ModalHubStore => {
  const hub = useContext(ModalContext);
  if (!hub) {
    throw new Error('[react-modal-hub] useModalHub must be used inside <ModalHub>.');
  }
  return hub;
};
```

Note: the second test also needs `src/index.tsx` exporting the new `ModalHub` (Task 5 Step 4).

- [ ] **Step 4: Replace index.tsx with a minimal ModalHub (naive full-state subscription)**

Replace `src/index.tsx` with:

```tsx
import cx from 'classnames';
import { useSyncExternalStore, type ComponentType } from 'react';
import { ModalContext } from './context';
import { modalHub } from './store';
import type { ModalComponentProps, ModalHubProps } from './types';

const CLASS_NAME = 'react-modal-hub';

const ModalHub = ({
  modals = {},
  eagerModals = {},
  ready = true,
  className,
  children,
  ...rest
}: ModalHubProps) => {
  useSyncExternalStore(
    (onChange) => modalHub.subscribe(onChange),
    () => modalHub.getSnapshot()
  );
  const eagerEntries = Object.entries(eagerModals);
  const modalEntries = ready ? Object.entries(modals) : [];

  const renderItem = (name: string, Component: ComponentType<ModalComponentProps>) => {
    const snapshot = modalHub.get(name);
    return <Component key={name} name={name} data={snapshot.data} visible={snapshot.visible} />;
  };

  return (
    <ModalContext.Provider value={modalHub}>
      <div data-component={CLASS_NAME} className={cx(CLASS_NAME, className)} {...rest}>
        {children}
        {eagerEntries.map(([name, Component]) => renderItem(name, Component))}
        {modalEntries.map(([name, Component]) => renderItem(name, Component))}
      </div>
    </ModalContext.Provider>
  );
};

ModalHub.displayName = CLASS_NAME;

export default ModalHub;
export { useModalHub } from './context';
export { modalHub, ModalHubStore } from './store';
export type * from './types';
```

This naive version subscribes the Provider to the whole state — deliberately, so Task 7's render-isolation test fails first (TDD).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS — all suites green (including original `01-basic`)

- [ ] **Step 6: Commit**

```bash
git add src/context.ts src/index.tsx __tests__/05-context.spec.tsx
git commit -m "feat(lib): add ModalHub provider and useModalHub hook"
```

---

### Task 6: Provider integration (ready / eagerModals / visibility / data flow)

**Files:**
- Modify: `src/index.tsx` (only if a step reveals a gap; naive impl from Task 5 should already cover these)
- Test: `__tests__/06-provider.spec.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/06-provider.spec.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModalHub from '../src';
import { modalHub } from '../src/store';
import type { ModalComponentProps } from '../src/types';

const Login = ({ visible }: ModalComponentProps) => (
  <div data-testid="login">{visible ? 'login-on' : 'login-off'}</div>
);

const Toast = ({ visible }: ModalComponentProps) => (
  <div data-testid="toast">{visible ? 'toast-on' : 'toast-off'}</div>
);

describe('ModalHub provider', () => {
  it('renders children inside the container', () => {
    const { container } = render(<ModalHub>hello</ModalHub>);
    expect(container.querySelector('[data-component="react-modal-hub"]')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('mounts modals only when ready; eagerModals always mount', () => {
    const ui = (ready: boolean) => (
      <ModalHub ready={ready} modals={{ login: Login }} eagerModals={{ toast: Toast }}>
        x
      </ModalHub>
    );
    const { rerender } = render(ui(false));
    expect(screen.queryByTestId('login')).not.toBeInTheDocument();
    expect(screen.getByTestId('toast')).toBeInTheDocument();

    rerender(ui(true));
    expect(screen.getByTestId('login')).toHaveTextContent('login-off');
  });

  it('drives visibility and data from the store', async () => {
    render(<ModalHub modals={{ login: Login }}>x</ModalHub>);
    expect(screen.getByTestId('login')).toHaveTextContent('login-off');

    await act(async () => {
      await modalHub.show('login', { from: 'header' });
    });
    expect(screen.getByTestId('login')).toHaveTextContent('login-on');

    await act(async () => {
      await modalHub.hide('login');
    });
    expect(screen.getByTestId('login')).toHaveTextContent('login-off');
  });
});
```

Note: `Login`/`Toast` render a marker unconditionally so "mounted vs not mounted" is observable in the DOM (`visible` only toggles the text).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- 06-provider`
Expected: FAIL if Task 5 Step 4 implementation has any gap; if PASS, this task only locks behavior (acceptable — assert all 3 pass before moving on).

- [ ] **Step 3: Fix any gap found (expected: none)**

If a test fails, adjust `src/index.tsx` minimally to satisfy it. Do NOT change store semantics.

- [ ] **Step 4: Run full suite**

Run: `pnpm test`
Expected: PASS — all suites including `01-basic`

- [ ] **Step 5: Commit**

```bash
git add __tests__/06-provider.spec.tsx
git commit -m "test(lib): cover provider ready/eager and store-driven visibility"
```

(If `src/index.tsx` was adjusted, include it in the add.)

---

### Task 7: Render isolation (memo + per-name selector)

**Files:**
- Modify: `src/index.tsx`
- Test: `__tests__/07-isolation.spec.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/07-isolation.spec.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModalHub from '../src';
import { modalHub } from '../src/store';
import type { ModalComponentProps } from '../src/types';

const counts = { a: 0, b: 0 };

const A = ({ visible, data }: ModalComponentProps) => {
  counts.a += 1;
  return <div data-testid="a">{visible ? `a:${data?.n}` : 'a-off'}</div>;
};

const B = ({ visible }: ModalComponentProps) => {
  counts.b += 1;
  return <div data-testid="b">{visible ? 'b-on' : 'b-off'}</div>;
};

describe('render isolation', () => {
  it("show('a') re-renders only modal a", async () => {
    counts.a = 0;
    counts.b = 0;
    render(
      <ModalHub modals={{ a: A, b: B }}>
        x
      </ModalHub>
    );
    expect(screen.getByTestId('a')).toHaveTextContent('a-off');
    expect(screen.getByTestId('b')).toHaveTextContent('b-off');

    const bBefore = counts.b;
    await act(async () => {
      await modalHub.show('a', { n: 1 });
    });

    expect(screen.getByTestId('a')).toHaveTextContent('a:1');
    expect(counts.a).toBeGreaterThan(1);
    expect(counts.b).toBe(bBefore); // b must not re-render
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- 07-isolation`
Expected: FAIL — naive Provider subscribes to whole state → Provider re-renders → both A and B re-render → `counts.b` increased

- [ ] **Step 3: Implement per-name subscription wrapper**

Replace `src/index.tsx` with:

```tsx
import cx from 'classnames';
import { memo, useSyncExternalStore, type ComponentType } from 'react';
import { ModalContext, useModalHub } from './context';
import { modalHub } from './store';
import type { ModalComponentProps, ModalHubProps, ModalSnapshot } from './types';

const CLASS_NAME = 'react-modal-hub';

const EMPTY_SNAPSHOT: ModalSnapshot = Object.freeze({ visible: false, data: null });

type ModalEntryProps = {
  name: string;
  Component: ComponentType<ModalComponentProps>;
};

const ModalEntry = memo(function ModalEntry({ name, Component }: ModalEntryProps) {
  const hub = useModalHub();
  const snapshot = useSyncExternalStore(
    (onChange) => hub.subscribe(onChange),
    () => hub.getSnapshot().modals[name] || EMPTY_SNAPSHOT
  );
  return <Component name={name} data={snapshot.data} visible={snapshot.visible} />;
});

const ModalHub = ({
  modals = {},
  eagerModals = {},
  ready = true,
  className,
  children,
  ...rest
}: ModalHubProps) => {
  const eagerEntries = Object.entries(eagerModals);
  const modalEntries = ready ? Object.entries(modals) : [];

  return (
    <ModalContext.Provider value={modalHub}>
      <div data-component={CLASS_NAME} className={cx(CLASS_NAME, className)} {...rest}>
        {children}
        {eagerEntries.map(([name, Component]) => (
          <ModalEntry key={name} name={name} Component={Component} />
        ))}
        {modalEntries.map(([name, Component]) => (
          <ModalEntry key={name} name={name} Component={Component} />
        ))}
      </div>
    </ModalContext.Provider>
  );
};

ModalHub.displayName = CLASS_NAME;

export default ModalHub;
export { useModalHub } from './context';
export { modalHub, ModalHubStore } from './store';
export type * from './types';
```

Why it works: `EMPTY_SNAPSHOT` is a module-level constant so `getSnapshot()` for an unknown name is referentially stable (a fresh `{}` would loop `useSyncExternalStore` forever). The `ModalHub` Provider itself no longer subscribes; only each `ModalEntry` does, so a change to `modals.a` yields a new reference only for `a`. `memo` blocks re-renders coming from parent re-renders (props `name`/`Component` are stable).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS — all suites green (01–07 + original 01-basic)

- [ ] **Step 5: Commit**

```bash
git add src/index.tsx __tests__/07-isolation.spec.tsx
git commit -m "feat(lib): isolate modal re-renders by per-name snapshot selector"
```

---

### Task 8: README + final verification

**Files:**
- Modify: `README.md` (repo root is project docs; package README is `packages/lib/README.md`)
- Verify: build

- [ ] **Step 1: Write README**

Replace `packages/lib/README.md` with:

````markdown
# @jswork/react-modal-hub
> One hub to present, dismiss, and sync every React modal.

## installation
```shell
npm install @jswork/react-modal-hub
```

## usage

```tsx
import '@jswork/next'; // optional: enables nx.$modal outside components
import ModalHub, { useModalHub } from '@jswork/react-modal-hub';

import Login from './modals/login';
import Toast from './modals-eager/toast';

export default ({ children }) => (
  <ModalHub modals={{ login: Login }} eagerModals={{ toast: Toast }} ready={true}>
    {children}
  </ModalHub>
);
```

Inside components:

```tsx
const $modal = useModalHub();
await $modal.show('login', { from: 'header' });
await $modal.hide('login');
```

Outside components (after `@jswork/next` is loaded):

```ts
await nx.$modal.show('login');
await nx.$modal.hide('login');
await nx.$modal.hideAll();
await nx.$modal.when('login');        // resolves on hide; .destroy() cancels
nx.$modal.get('login');               // { visible, data }
const sub = nx.$modal.on('login:show', (data) => {});
sub.destroy();                        // unsubscribe (no off/once)
```

Modal components receive `{ name, data, visible }` and decide what to render:

```tsx
export default ({ data, visible }) => (visible ? <div>hi {data?.from}</div> : null);
```

## props

| prop | type | default | description |
|------|------|---------|-------------|
| `modals` | `Record<string, ComponentType>` | `{}` | mounted when `ready` is true |
| `eagerModals` | `Record<string, ComponentType>` | `{}` | always mounted |
| `ready` | `boolean` | `true` | mount timing for `modals` |

## migration (from react-modal-manager)

| react-modal-manager | react-modal-hub |
|---------------------|-----------------|
| `<ReactModalManager modules eagerModules ready harmony>` | `<ModalHub modals eagerModals ready>` |
| `present(data)` (default name) | `show(name, data)` |
| `dismiss(name?)` | `hide(name)` |
| `inject` callback | removed |
| `harmony` (`window.nx.$modal = store`) | automatic `nx.$modal` on import |
| events `:present` / `:dismiss` | `{name}:show` / `{name}:hide` |
| `presentWhen` | `when(name)` + `.destroy()` |
| `visible()` / `data()` / `value()` | `get(name)` |
| `off` / `once` | removed — `on` returns `{ destroy }` |

## license
Code released under [the MIT license](https://github.com/afeiship/react-modal-hub/blob/master/LICENSE.txt).
````

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: PASS — all suites

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: `dist/index.esm.js`, `dist/index.cjs.js`, `dist/index.d.ts` produced, no TS errors

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(lib): add readme with api reference and migration table"
```

---

## Final verification checklist

- [ ] `pnpm test` — all suites green (store, events, when, nx, context, provider, isolation, original basic)
- [ ] `pnpm build` — clean build with type declarations
- [ ] No runtime dependencies added (package.json `dependencies` absent)
- [ ] Git log shows one commit per task, messages in English
