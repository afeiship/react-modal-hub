import { useSyncExternalStore, type ComponentType } from 'react';
import { ModalContext } from './context';
import { modalHub } from './store';
import type { ModalComponentProps, ModalHubProps } from './types';

const ModalHub = ({
  modals = {},
  modalsEager = {},
  ready = true,
  children,
}: ModalHubProps) => {
  useSyncExternalStore(
    (onChange) => modalHub.subscribe(onChange),
    () => modalHub.getSnapshot()
  );
  const eagerEntries = Object.entries(modalsEager);
  const modalEntries = ready ? Object.entries(modals) : [];

  const renderItem = (name: string, Component: ComponentType<ModalComponentProps>) => {
    const snapshot = modalHub.get(name);
    return <Component key={name} name={name} data={snapshot.data} visible={snapshot.visible} />;
  };

  return (
    <ModalContext.Provider value={modalHub}>
      {children}
      {eagerEntries.map(([name, Component]) => renderItem(name, Component))}
      {modalEntries.map(([name, Component]) => renderItem(name, Component))}
    </ModalContext.Provider>
  );
};

ModalHub.displayName = 'ModalHub';

export default ModalHub;
export { useModalHub } from './context';
export { modalHub, ModalHubStore } from './store';
export type * from './types';