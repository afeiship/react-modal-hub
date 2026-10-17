import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModalHub from '../src';
import { useModalHub } from '../src/context';
import { modalHub } from '../src/store';

const Probe = () => {
  const hub = useModalHub();
  return <span data-testid="hub">{hub === modalHub ? 'same' : 'diff'}</span>;
};

describe('useModalHub', () => {
  it('throws a clear error outside the provider', () => {
    expect(() => render(<Probe />)).toThrow('useModalHub must be used inside <ModalHub>');
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
