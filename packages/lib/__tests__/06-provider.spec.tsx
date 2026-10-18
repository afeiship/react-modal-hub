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
