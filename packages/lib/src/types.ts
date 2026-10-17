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
