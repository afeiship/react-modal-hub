import { Component, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModalHub from '../src';
import { useModalHub } from '../src/context';
import { modalHub } from '../src/store';

class CatchError extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <span data-testid="error-msg">{this.state.error.message}</span>;
    }
    return this.props.children;
  }
}

const Probe = () => {
  const hub = useModalHub();
  return <span data-testid="hub">{hub === modalHub ? 'same' : 'diff'}</span>;
};

describe('useModalHub', () => {
  it('throws a clear error outside the provider', () => {
    const suppressError = (e: Event) => e.preventDefault();
    window.addEventListener('error', suppressError);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(
        <CatchError>
          <Probe />
        </CatchError>
      );
      expect(screen.getByTestId('error-msg')).toHaveTextContent(
        '[react-modal-hub] useModalHub must be used inside <ModalHub>.'
      );
    } finally {
      window.removeEventListener('error', suppressError);
      spy.mockRestore();
    }
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
