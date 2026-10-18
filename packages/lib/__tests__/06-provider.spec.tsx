import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModalHub from '../src';
import { modalHub } from '../src/store';

// 真实使用场景：弹窗组件不接收注入 props，自行读取 store
const Login = () => {
  const { visible } = modalHub.get('login');
  return <div data-testid="login">{visible ? 'login-on' : 'login-off'}</div>;
};

const Toast = () => {
  const { visible } = modalHub.get('toast');
  return <div data-testid="toast">{visible ? 'toast-on' : 'toast-off'}</div>;
};

describe('ModalHub provider', () => {
  it('renders children directly without container tag', () => {
    const { container } = render(<ModalHub><span>hello</span></ModalHub>);
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(container.firstChild).toBe(screen.getByText('hello'));
  });

  it('mounts modals only when ready; modalsEager always mount', () => {
    const ui = (ready: boolean) => (
      <ModalHub ready={ready} modals={{ login: Login }} modalsEager={{ toast: Toast }}>
        x
      </ModalHub>
    );
    const { rerender } = render(ui(false));
    expect(screen.queryByTestId('login')).not.toBeInTheDocument();
    expect(screen.getByTestId('toast')).toBeInTheDocument();

    rerender(ui(true));
    expect(screen.getByTestId('login')).toHaveTextContent('login-off');
  });

  it('drives visibility from the store', async () => {
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

  it('only re-renders the target modal (render isolation)', async () => {
    let loginRenders = 0;
    let toastRenders = 0;
    const CountingLogin = () => {
      loginRenders++;
      return <Login />;
    };
    const CountingToast = () => {
      toastRenders++;
      return <Toast />;
    };

    render(
      <ModalHub modals={{ login: CountingLogin }} modalsEager={{ toast: CountingToast }}>
        x
      </ModalHub>
    );
    const loginBefore = loginRenders;
    const toastBefore = toastRenders;

    await act(async () => {
      await modalHub.show('login');
    });
    expect(loginRenders).toBeGreaterThan(loginBefore);
    expect(toastRenders).toBe(toastBefore);

    await act(async () => {
      await modalHub.hide('login');
    });
    expect(toastRenders).toBe(toastBefore);
  });
});
