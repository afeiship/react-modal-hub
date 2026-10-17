/**
 * 基础渲染测试
 * 验证 ReactModalHub 组件的基本渲染行为，包括：
 * - 默认 className 是否正确应用
 * - 自定义 className 是否能正确合并
 * - children 内容是否正常渲染
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReactModalHub from '../src';

describe('ReactModalHub', () => {
  it('should render with default className', () => {
    render(<ReactModalHub>hello</ReactModalHub>);
    const el = screen.getByText('hello');
    expect(el).toBeInTheDocument();
    expect(el.closest('[data-component="react-modal-hub"]')).toBeInTheDocument();
  });

  it('should merge custom className', () => {
    const { container } = render(<ReactModalHub className="custom-class">test</ReactModalHub>);
    expect(container.firstChild).toHaveClass('react-modal-hub', 'custom-class');
  });

  it('should render children', () => {
    render(<ReactModalHub>child content</ReactModalHub>);
    expect(screen.getByText('child content')).toBeInTheDocument();
  });
});
