import { memo, useSyncExternalStore, type ComponentType } from 'react';
import { ModalContext, useModalHub } from './context';
import { modalHub } from './store';
import type { ModalHubProps } from './types';

type ModalItemProps = {
  name: string;
  Component: ComponentType<any>;
};

const ModalItem = ({ name, Component }: ModalItemProps) => {
  const hub = useModalHub();
  // 只订阅自己 name 的快照：其它 name 变化时引用不变，useSyncExternalStore 自动 bail out
  useSyncExternalStore(
    (onChange) => hub.subscribe(onChange),
    () => hub.get(name)
  );
  // 不注入 props：弹窗组件自行通过 nx.$modal.get(name) 读取状态
  return <Component />;
};

const MemoizedModalItem = memo(ModalItem);

const ModalHub = ({
  modals = {},
  modalsEager = {},
  ready = true,
  children,
}: ModalHubProps) => {
  const modalEntries = ready ? Object.entries(modals) : [];

  return (
    <ModalContext.Provider value={modalHub}>
      {children}
      {Object.entries(modalsEager).map(([name, Component]) => (
        <MemoizedModalItem key={name} name={name} Component={Component} />
      ))}
      {modalEntries.map(([name, Component]) => (
        <MemoizedModalItem key={name} name={name} Component={Component} />
      ))}
    </ModalContext.Provider>
  );
};

ModalHub.displayName = 'ModalHub';

export default ModalHub;
export { useModalHub } from './context';
export { modalHub, ModalHubStore } from './store';
export type * from './types';
