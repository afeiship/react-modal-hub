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