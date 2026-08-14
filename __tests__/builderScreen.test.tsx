/**
 * Unit tests for the sequence builder screen.
 *
 * Two things here are only reachable by rendering the screen: the dead end a
 * malformed schlag:// link used to leave behind, and the rounds control,
 * whose label and saved value could disagree.
 */

import React from 'react';
import { act } from 'react';
// @ts-expect-error — no type declarations for react-test-renderer
import renderer from 'react-test-renderer';

// ---------------------------------------------------------------------------
// Mocks (must be declared before importing the screen)
// ---------------------------------------------------------------------------

jest.mock('uuid', () => {
  let n = 0;
  return { v4: () => `test-uuid-${++n}` };
});

let mockRouteId = 'new';
let mockCanGoBack = true;
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mockRouteId }),
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    push: jest.fn(),
    canGoBack: () => mockCanGoBack,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/IntervalRow', () => ({ IntervalRow: () => null }));
jest.mock('@/components/IntervalEditSheet', () => ({ IntervalEditSheet: () => null }));
jest.mock('@/components/DurationPicker', () => ({ DurationPicker: () => null }));

jest.mock('@/lib/storage', () => {
  const { DEFAULT_SETTINGS } = jest.requireActual('@/constants/defaults');
  let sequences: unknown[] = [];
  return {
    getSettings: jest.fn(() => ({ ...DEFAULT_SETTINGS })),
    saveSettings: jest.fn(() => true),
    getSequences: jest.fn(() => sequences),
    saveSequences: jest.fn((s: unknown[]) => {
      sequences = s;
      return true;
    }),
    getSessions: jest.fn(() => []),
    saveSessions: jest.fn(() => true),
    getTimerSession: jest.fn(() => null),
    saveTimerSession: jest.fn(() => true),
    clearTimerSession: jest.fn(),
    setStorageErrorHandler: jest.fn(),
  };
});

import BuilderScreen from '@/app/builder/[id]';
import { useSequenceStore } from '@/stores/sequenceStore';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type Tree = ReturnType<typeof renderer.create>;

function renderScreen(): Tree {
  let tree: Tree;
  act(() => {
    tree = renderer.create(<BuilderScreen />);
  });
  return tree!;
}

/** Find a node by the start of its accessibilityLabel. */
function findByLabelPrefix(tree: Tree, prefix: string) {
  const matches = tree.root.findAll(
    (n: { props?: { accessibilityLabel?: string } }) =>
      typeof n.props?.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith(prefix),
    { deep: true },
  );
  if (matches.length === 0) {
    throw new Error(`No node with accessibilityLabel starting "${prefix}"`);
  }
  return matches[0];
}

function labelStartingWith(tree: Tree, prefix: string): string {
  return findByLabelPrefix(tree, prefix).props.accessibilityLabel as string;
}

/** Every string rendered anywhere in the tree. */
function allText(tree: Tree): string {
  return JSON.stringify(tree.toJSON());
}

beforeEach(() => {
  // FlatList schedules its cell updates on a timeout. Nothing here depends
  // on them, and letting them land after the test warns about updates
  // outside act().
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockRouteId = 'new';
  mockCanGoBack = true;
  useSequenceStore.setState({ sequences: [], isLoaded: true });
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Deep links
// ---------------------------------------------------------------------------

describe('builder deep links', () => {
  it('goes back when a sequence is missing and there is a screen behind', () => {
    mockRouteId = 'does-not-exist';
    mockCanGoBack = true;

    renderScreen();

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows an error state on a cold start, where back is a no-op', () => {
    mockRouteId = 'does-not-exist';
    mockCanGoBack = false;

    const tree = renderScreen();

    expect(mockBack).not.toHaveBeenCalled();
    expect(allText(tree)).toContain('could not be found');
    expect(allText(tree)).not.toContain('Loading…');
  });

  it('offers a way to the home screen from the error state', () => {
    mockRouteId = 'does-not-exist';
    mockCanGoBack = false;

    const tree = renderScreen();
    act(() => {
      findByLabelPrefix(tree, 'Go to library').props.onPress();
    });

    // replace, not push — there is no history to push onto.
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('shows the error state when the link carries no id at all', () => {
    mockRouteId = '';
    mockCanGoBack = false;

    const tree = renderScreen();

    expect(allText(tree)).toContain('could not be found');
  });
});

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

describe('builder rounds control', () => {
  const ROUNDS = 'Rounds ×';
  const INFINITE = 'Infinite repeat mode';

  function setInfinite(tree: Tree, value: boolean) {
    act(() => {
      findByLabelPrefix(tree, INFINITE).props.onValueChange(value);
    });
  }

  function tapRounds(tree: Tree) {
    act(() => {
      findByLabelPrefix(tree, ROUNDS).props.onPress();
    });
  }

  it('shows ×∞ while infinite repeat is on', () => {
    const tree = renderScreen();
    setInfinite(tree, true);

    expect(labelStartingWith(tree, ROUNDS)).toContain('×∞');
  });

  it('drops ×∞ as soon as a round count is set', () => {
    const tree = renderScreen();
    setInfinite(tree, true);
    tapRounds(tree);

    expect(labelStartingWith(tree, ROUNDS)).toContain('×1');
    expect(labelStartingWith(tree, ROUNDS)).not.toContain('×∞');
  });

  it('saves the count the label is showing', () => {
    const tree = renderScreen();
    setInfinite(tree, true);
    tapRounds(tree);

    act(() => {
      findByLabelPrefix(tree, 'Save sequence').props.onPress();
    });

    const saved = useSequenceStore.getState().sequences;
    expect(saved).toHaveLength(1);
    // 0 would mean infinite — the label said ×1.
    expect(saved[0].repeat_count).toBe(1);
  });

  it('saves 0 when infinite is left on', () => {
    const tree = renderScreen();
    setInfinite(tree, true);

    act(() => {
      findByLabelPrefix(tree, 'Save sequence').props.onPress();
    });

    expect(useSequenceStore.getState().sequences[0].repeat_count).toBe(0);
  });

  it('keeps counting up from a finite value', () => {
    const tree = renderScreen();
    tapRounds(tree);
    tapRounds(tree);

    expect(labelStartingWith(tree, ROUNDS)).toContain('×3');
  });
});
