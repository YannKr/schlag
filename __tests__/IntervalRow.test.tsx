/**
 * IntervalRow component tests.
 *
 * Verifies the IntervalRow component does not nest button-role elements
 * (Pressable inside Pressable renders as <button> inside <button> on web).
 */

import React from 'react';
import { act } from 'react';
// @ts-expect-error — no type declarations for react-test-renderer
import renderer from 'react-test-renderer';
import { IntervalRow } from '@/components/IntervalRow';
import type { Interval } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInterval(overrides?: Partial<Interval>): Interval {
  return {
    id: 'int-1',
    name: 'Work',
    duration_seconds: 30,
    color: '#E63946',
    note: '',
    ...overrides,
  };
}

const noop = () => {};

interface RendererNode {
  type: string;
  props?: Record<string, unknown>;
  children?: (RendererNode | string)[] | null;
}

function findButtonNodes(node: RendererNode | string): RendererNode[] {
  if (typeof node === 'string') return [];
  const results: RendererNode[] = [];

  const isButton =
    node.props?.accessibilityRole === 'button' ||
    node.props?.role === 'button' ||
    node.type === 'button';

  if (isButton) results.push(node);

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      results.push(...findButtonNodes(child));
    }
  }

  return results;
}

function hasNestedButtons(node: RendererNode | string): boolean {
  if (typeof node === 'string') return false;

  const isButton =
    node.props?.accessibilityRole === 'button' ||
    node.props?.role === 'button' ||
    node.type === 'button';

  if (isButton && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (typeof child !== 'string') {
        const descendants = findButtonNodes(child);
        if (descendants.length > 0) return true;
      }
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (hasNestedButtons(child)) return true;
    }
  }

  return false;
}

function renderRow(props?: Partial<React.ComponentProps<typeof IntervalRow>>) {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <IntervalRow
        interval={makeInterval(props?.interval as Partial<Interval> | undefined)}
        index={props?.index ?? 0}
        totalCount={props?.totalCount ?? 3}
        onPress={props?.onPress ?? noop}
        onMoveUp={props?.onMoveUp ?? noop}
        onMoveDown={props?.onMoveDown ?? noop}
        onDelete={props?.onDelete ?? noop}
      />,
    );
  });
  return tree!;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IntervalRow', () => {
  it('renders without crashing', () => {
    const tree = renderRow();
    const json = tree.toJSON();
    expect(json).not.toBeNull();
  });

  it('does not nest button-role elements (no <button> inside <button>)', () => {
    const tree = renderRow({ index: 1 });
    const json = tree.toJSON() as RendererNode;
    expect(json).not.toBeNull();
    expect(hasNestedButtons(json)).toBe(false);
  });

  it('outer container is a View without button role', () => {
    const tree = renderRow();
    const json = tree.toJSON() as RendererNode;
    expect(json).not.toBeNull();
    expect(json.type).not.toBe('button');
    expect(json.props?.accessibilityRole).not.toBe('button');
  });

  it('contains exactly 3 interactive button-role children (move-up, move-down, delete)', () => {
    const tree = renderRow({ index: 1 });
    const json = tree.toJSON() as RendererNode;
    expect(json).not.toBeNull();
    const allButtons = findButtonNodes(json);
    expect(allButtons.length).toBe(3);
  });

  it('disables move-up on first item and move-down on last item', () => {
    const tree = renderRow({ index: 0, totalCount: 1 });
    const json = tree.toJSON() as RendererNode;
    expect(json).not.toBeNull();

    const buttons = findButtonNodes(json);
    const moveUp = buttons.find(
      (b) => b.props?.accessibilityLabel === 'Move interval up',
    );
    const moveDown = buttons.find(
      (b) => b.props?.accessibilityLabel === 'Move interval down',
    );

    expect(moveUp).toBeDefined();
    expect(moveDown).toBeDefined();
    expect(moveUp?.props?.accessibilityState).toEqual({ disabled: true });
    expect(moveDown?.props?.accessibilityState).toEqual({ disabled: true });
  });
});
