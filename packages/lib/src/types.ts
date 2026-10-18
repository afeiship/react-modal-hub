import type { ComponentType, ReactNode } from 'react';

export type ModalSnapshot = {
  visible: boolean;
  data: any;
};

export type ModalHubState = {
  modals: Record<string, ModalSnapshot>;
};

// 弹窗组件不接收注入 props，自行通过 nx.$modal.get(name) 读取状态
export type ModalComponent = ComponentType<any>;

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
  modalsEager?: Record<string, ModalComponent>;
  /**
   * Controls whether modals are mounted.
   * @default true
   */
  ready?: boolean;
  /**
   * The children element.
   */
  children?: ReactNode;
};
