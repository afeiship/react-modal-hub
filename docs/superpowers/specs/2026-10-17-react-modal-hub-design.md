# react-modal-hub 设计文档

日期：2026-10-17
状态：已评审通过（brainstorming 阶段）
范围：`packages/lib`（`@jswork/react-modal-hub` 1.0.0，全新包，不兼容 `@jswork/react-modal-manager`）

## 1. 定位

一个"弹窗调度中心"（modal orchestrator/hub）：弹窗组件不自持开关状态，全部由 hub 统一 show/hide；组件外（路由拦截、埋点、nx 框架代码）也能调用。

与旧项目 `react-modal-manager` 的关系：概念上是其重写版，API 全新设计，不保持任何兼容；README 附新旧 API 对照表。

## 2. API 总览

### 2.1 全局单例 `nx.$modal`

包被 import 时创建模块级单例 store 并挂到 `nx.$modal`（对齐 `react-tiny-state` 的模式；假定 `@jswork/next` 先于本包加载，`nx` 一定存在于 global）。

```ts
import '@jswork/next';
import '@jswork/react-modal-hub';

// 组件外任何地方
await nx.$modal.show('login', { from: 'header' }); // Promise：状态提交（重渲染完成）后 resolve
await nx.$modal.hide('login');                     // 同上
await nx.$modal.hideAll();                         // 关闭全部已注册弹窗，Promise.all
await nx.$modal.when('login');                     // 等 login 被 hide 后 resolve；可 destroy() 取消
const { visible, data } = nx.$modal.get('login');  // 状态快照 { visible: boolean; data: any }
const sub = nx.$modal.on('login:show', (data) => {}); // 订阅，返回 Subscription { destroy }
sub.destroy();                                       // 退订（无 off / 无 once）
const w = nx.$modal.when('login');               // 等 login 被 hide 后 resolve
w.destroy();                                           // 取消等待（与 on 同一形态）
```

API 签名（全部 `name` 显式必传，无单例/省略 name 模式）：

| 方法 | 签名 | 语义 |
|------|------|------|
| `show` | `(name: string, data?: any) => Promise<void>` | 置 `{ visible: true, data }`，提交后 emit `{name}:show` 并 resolve |
| `hide` | `(name: string) => Promise<void>` | 置 `{ visible: false, data: {} }`，提交后 emit `{name}:hide` 并 resolve |
| `hideAll` | `() => Promise<void>` | 对当前状态中所有 name 执行 hide，`Promise.all` |
| `when` | `(name: string) => Promise<void> & { destroy(): void }` | 等 `{name}:hide` 事件；`destroy()` 移除监听（防泄漏），hide 触发时自动清理 |
| `get` | `(name: string) => { visible: boolean; data: any }` | 快照；未出现过的 name 返回 `{ visible: false, data: null }` |
| `on` | `(event: string, fn) => { destroy(): void }` | 事件订阅，事件名 `{name}:show` / `{name}:hide`；`destroy()` 退订 |

事件 API 只有 `on` 一个入口：**无 `off`、无 `once`**（一次性订阅 = 回调内 `sub.destroy()`；退订统一为 `destroy()` 一种姿势，`when` 复用同一形态）。

### 2.2 组件内 hook

```tsx
const $modal = useModalHub(); // 返回全局单例 store，与 nx.$modal 同一实例
$modal.show('login');
```

Provider 外使用 `useModalHub()` 抛出明确错误（`createContext` 默认值为 `null`）。

### 2.3 Provider 组件（默认导出）

```tsx
<ModalHub
  modals={{ login: Login, confirm: Confirm }}
  eagerModals={{ toast: Toast }}
  ready={true}
>
  {children}
</ModalHub>
```

| Prop | 类型 | 默认 | 语义 |
|------|------|------|------|
| `modals` | `Record<string, ComponentType<any>>` | `{}` | `ready === true` 时全部挂载（常驻挂载、受控显隐） |
| `eagerModals` | `Record<string, ComponentType<any>>` | `{}` | 始终挂载，无视 `ready` |
| `ready` | `boolean` | `true` | 控制 `modals` 的渲染时机（异步资源就绪场景） |
| `className` / 其余 `HTMLAttributes` | — | — | 透传到容器 div |

弹窗组件收到的 props：`{ name: string, data: any, visible: boolean }`（wrapper 从 store 快照注入，组件内部据此渲染 `null` 或内容）。

**渲染隔离（1.0）**：任意一次 `show/hide` 不得触发全部弹窗重渲染。每个弹窗由 wrapper 包 `memo`，内部用 `useSyncExternalStore` + selector 只订阅自己 name 的快照 `{ visible, data }`；该 name 快照引用不变则跳过渲染。`show('login')` 只更新 login 一个弹窗。

**边角语义（钉死）**：

- 重复 `show` 已 visible 的 name → 更新 data，重新 emit `{name}:show`
- `hide` 未出现过的 name → 直接 resolve，不 emit
- 懒挂载不进 1.0：`ready` 后常驻挂载，退出动画由组件在收到 `visible: false` 后自管（常驻挂载下组件可自行播动画再渲染 null）

### 2.4 明确砍掉的旧特性

无兼容包袱，以下旧特性不进入 1.0：

- 单例模式（`present(data)` 走默认名；`name` prop 与默认名 `'nx-modal'`）
- `inject` 回调
- `harmony` / `window.nx.$modal = store` 手动挂载（新版由 import 副作用自动挂）
- 旧事件名 `:present` / `:dismiss`
- `presentWhen`（由 `when` 取代并修复泄漏）
- `visible()` / `data()` / `value()` 单字段查询（由 `get` 取代）
- 事件 `off` / `once`（退订只有 `on` 返回的 `destroy()` 一种姿势）

## 3. 内部架构

### 3.1 文件结构

```
packages/lib/src/
├── index.tsx        # ModalHub 组件（默认导出）：渲染 modals/eagerModals + Context.Provider
├── store.ts         # ModalHubStore 类 + 模块级单例 modalHub + import 副作用挂 nx.$modal
├── context.ts       # ModalContext（默认 null）+ useModalHub hook
├── types.ts         # 公共类型（ModalHubProps、ModalSnapshot、ModalComponentProps 等）
└── style.scss       # 保留空壳类名规则（容器 data-component）
```

### 3.2 ModalHubStore（核心，~100 行，零运行时依赖）

- 自持不可变状态：`{ modals: Record<string, { visible: boolean; data: any }> }`；每次变更产生新对象，不原地修改
- `subscribe(listener) => unsubscribe` 与 `getSnapshot() => state` 对接 React 18 `useSyncExternalStore`
- **Promise 语义（统一）**：`show`/`hide` 先更新内部状态并通知订阅者，随后在微任务（React 提交后）emit 事件并 resolve。所有方法语义一致，调用方 `await` 后可安全读 DOM / 接过渡动画
- **事件总线自实现**：内部 `Map<string, Set<fn>>`，只提供 `on`（返回 `Subscription { destroy }`），事件名约定 `'{name}:show'` / `'{name}:hide'`
- **`when` 防泄漏**：返回 `Promise & { destroy() }`，`destroy()` 移除内部监听；hide 正常触发时自动清理（与 `on` 同一形态）
- 模块级单例：`export const modalHub = new ModalHubStore()`；store 文件内 import 副作用执行 `nx.$modal = modalHub`（假定 `nx` 全局存在，缺省时静默跳过或仅在调用时报错——实现时取"静默跳过 + 类型声明 `NxStatic.$modal`"）
- 可脱离 React 独立单测

### 3.3 数据流

```
调用方（组件内 $modal.show / 组件外 nx.$modal.show）
        │
        ▼
  ModalHubStore.show(name, data)
        │ 1. 不可变更新 modals[name] = { visible: true, data }
        │ 2. notify 订阅者
        ▼
  useSyncExternalStore → ModalHub 重渲染
        │ 3. 向已挂载的弹窗组件注入 { name, data, visible }
        ▼
  微任务：emit('{name}:show') → show 的 Promise resolve
        │
        ▼
  订阅方（nx.$modal.on('login:show', ...)）收到事件
```

### 3.4 测试策略（vitest + @testing-library/react + jsdom）

- **store 单测**（不依赖 React）：
  - show/hide 状态流转与 `get` 快照
  - Promise resolve 发生在状态提交之后（时序断言）
  - `hideAll` 关闭全部
  - `when`：正常 hide 触发 resolve；`destroy()` 后不再 resolve
  - 事件 `on` 触发与 `destroy()` 退订；`{name}:show`/`:hide` 命名
  - 边角语义：重复 show 重新 emit；hide 未注册 name 直接 resolve 不 emit
- **组件集成测**：
  - `show`/`hide` 触发弹窗组件收到新 `visible`/`data` 并重渲染
  - 渲染隔离：`show('a')` 不引起弹窗 b 重渲染（渲染计数断言）
  - `ready={false}` 时不挂载 `modals`，`eagerModals` 始终挂载
  - Provider 外调用 `useModalHub` 抛错
  - Provider 内 hook 与 `nx.$modal` 为同一实例

## 4. 交付与约束

- 位置：已有脚手架 `react-modal-hub` 仓库的 `packages/lib`（pnpm workspace + tsup + vitest + TS 5）
- React 18 peer dependency；`@jswork/next` 为可选协作方（import 副作用挂载用，不在 dependencies 中强制引入）
- 零运行时依赖（事件总线、状态管理全部自实现；不使用 `object-path`、`@jswork/event-mitt`、zustand）
- 包名 `@jswork/react-modal-hub`，description：`One hub to present, dismiss, and sync every React modal.`
- 只动 `packages/lib`，仓库根配置不动；提交信息英文
