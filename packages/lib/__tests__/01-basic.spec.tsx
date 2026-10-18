/**
 * 基础渲染测试
 * 验证 ModalHub 组件作为纯容器的基本渲染行为：
 * - 纯容器，不生成任何额外的外层 DOM tag
 * - children 内容正常渲染
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModalHub from '../src';

describe('ModalHub basic rendering', () => {
  it('should render children directly without extra container tag', () => {
    const { container } = render(
      <ModalHub>
        <span data-testid="child">hello</span>
      </ModalHub>
    );
    const child = screen.getByTestId('child');
    expect(child).toBeInTheDocument();
    expect(child).toHaveTextContent('hello');
    // 容器直接是 child，没有额外的外部 wrapper tag
    expect(container.firstChild).toBe(child);
  });

  it('should render multiple children elements directly', () => {
    const { container } = render(
      <ModalHub>
        <header>Header</header>
        <main>Main Content</main>
      </ModalHub>
    );
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Main Content')).toBeInTheDocument();
    expect(container.children.length).toBe(2);
  });
});
