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