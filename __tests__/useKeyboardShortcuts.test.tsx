/**
 * Unit tests for useKeyboardShortcuts — the web-only workout keyboard hook.
 *
 * Covers the newly wired E (expand), M (mute), and ? (overlay) bindings,
 * the overlay-open swallow behavior (only ? and Escape pass through), the
 * input-field guard, the pause/resume branch, listener cleanup on unmount,
 * the native no-op, and the single-registration guarantee (the listener is
 * attached once and reads fresh handlers through a ref, not re-attached on
 * every render).
 *
 * Platform.OS is exposed via a getter so tests can flip web/native, and
 * `document` is stubbed (jest-expo runs in a node environment).
 */

import React from 'react';
import { act } from 'react';
// @ts-expect-error — no type declarations for react-test-renderer
import renderer from 'react-test-renderer';

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports of the module under test)
// ---------------------------------------------------------------------------

let mockPlatformOS: 'ios' | 'android' | 'web' = 'web';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

import {
  useKeyboardShortcuts,
  type KeyboardShortcutHandlers,
} from '@/hooks/useKeyboardShortcuts';

// ---------------------------------------------------------------------------
// document stub
// ---------------------------------------------------------------------------

const addEventListener = jest.fn();
const removeEventListener = jest.fn();

beforeAll(() => {
  Object.defineProperty(globalThis, 'document', {
    value: { addEventListener, removeEventListener },
    configurable: true,
    writable: true,
  });
});

afterAll(() => {
  delete (globalThis as Record<string, unknown>).document;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Host(props: KeyboardShortcutHandlers) {
  useKeyboardShortcuts(props);
  return null;
}

function makeHandlers(
  overrides: Partial<KeyboardShortcutHandlers> = {},
): KeyboardShortcutHandlers {
  return {
    onPause: jest.fn(),
    onResume: jest.fn(),
    onSkip: jest.fn(),
    onStop: jest.fn(),
    onToggleExpanded: jest.fn(),
    onToggleMute: jest.fn(),
    onShowShortcuts: jest.fn(),
    isPaused: false,
    isOverlayVisible: false,
    ...overrides,
  };
}

function render(handlers: KeyboardShortcutHandlers) {
  let tree: ReturnType<typeof renderer.create>;
  act(() => {
    tree = renderer.create(<Host {...handlers} />);
  });
  return tree!;
}

/** The most recently registered keydown handler. */
function latestKeydownHandler(): (event: unknown) => void {
  const call = addEventListener.mock.calls
    .filter(([type]) => type === 'keydown')
    .at(-1);
  if (!call) throw new Error('no keydown listener registered');
  return call[1];
}

interface FakeTarget {
  tagName: string;
  isContentEditable: boolean;
  /** Mirrors Element.closest — used by the focused-button Space guard. */
  closest?: (selector: string) => unknown;
}

function press(key: string, target: FakeTarget | null = null) {
  const event = { key, preventDefault: jest.fn(), target };
  act(() => {
    latestKeydownHandler()(event);
  });
  return event;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatformOS = 'web';
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useKeyboardShortcuts', () => {
  it('registers a keydown listener on web and removes it on unmount', () => {
    const tree = render(makeHandlers());
    expect(addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));

    act(() => {
      tree.unmount();
    });
    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('attaches the keydown listener exactly once across re-renders', () => {
    const tree = render(makeHandlers());
    // Simulate the ~60fps tick: new handler objects on every render.
    act(() => {
      tree.update(<Host {...makeHandlers()} />);
    });
    act(() => {
      tree.update(<Host {...makeHandlers({ isPaused: true })} />);
    });

    const keydownAdds = addEventListener.mock.calls.filter(
      ([type]) => type === 'keydown',
    );
    expect(keydownAdds).toHaveLength(1);
    expect(removeEventListener).not.toHaveBeenCalled();
  });

  it('sees fresh handlers through the ref without re-registering', () => {
    const first = makeHandlers();
    const tree = render(first);

    const second = makeHandlers();
    act(() => {
      tree.update(<Host {...second} />);
    });

    press('n');
    expect(first.onSkip).not.toHaveBeenCalled();
    expect(second.onSkip).toHaveBeenCalledTimes(1);
  });

  it('is a no-op on native platforms', () => {
    mockPlatformOS = 'ios';
    render(makeHandlers());
    expect(addEventListener).not.toHaveBeenCalled();
  });

  it('Space/k pauses when running and resumes when paused', () => {
    const running = makeHandlers({ isPaused: false });
    const tree = render(running);
    press(' ');
    expect(running.onPause).toHaveBeenCalledTimes(1);
    expect(running.onResume).not.toHaveBeenCalled();

    const paused = makeHandlers({ isPaused: true });
    act(() => {
      tree.update(<Host {...paused} />);
    });
    press('k');
    expect(paused.onResume).toHaveBeenCalledTimes(1);
    expect(paused.onPause).not.toHaveBeenCalled();
  });

  it('e toggles expanded view and prevents default', () => {
    const handlers = makeHandlers();
    render(handlers);
    const event = press('e');
    expect(handlers.onToggleExpanded).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('m toggles mute and prevents default', () => {
    const handlers = makeHandlers();
    render(handlers);
    const event = press('m');
    expect(handlers.onToggleMute).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('? shows the shortcut overlay', () => {
    const handlers = makeHandlers();
    render(handlers);
    press('?');
    expect(handlers.onShowShortcuts).toHaveBeenCalledTimes(1);
  });

  it('Escape/q stop the workout when the overlay is closed', () => {
    const handlers = makeHandlers();
    render(handlers);
    press('Escape');
    press('q');
    expect(handlers.onStop).toHaveBeenCalledTimes(2);
  });

  it('swallows workout shortcuts while the overlay is open', () => {
    const handlers = makeHandlers({ isOverlayVisible: true });
    render(handlers);
    press(' ');
    press('k');
    press('n');
    press('q');
    press('e');
    press('m');
    expect(handlers.onPause).not.toHaveBeenCalled();
    expect(handlers.onResume).not.toHaveBeenCalled();
    expect(handlers.onSkip).not.toHaveBeenCalled();
    expect(handlers.onStop).not.toHaveBeenCalled();
    expect(handlers.onToggleExpanded).not.toHaveBeenCalled();
    expect(handlers.onToggleMute).not.toHaveBeenCalled();
  });

  it('? and Escape both close the overlay while it is open', () => {
    const handlers = makeHandlers({ isOverlayVisible: true });
    render(handlers);
    press('?');
    press('Escape');
    expect(handlers.onShowShortcuts).toHaveBeenCalledTimes(2);
    // Escape must NOT stop the workout while the overlay is open.
    expect(handlers.onStop).not.toHaveBeenCalled();
  });

  it('ignores keys typed into input fields', () => {
    const handlers = makeHandlers();
    render(handlers);
    press('m', { tagName: 'INPUT', isContentEditable: false });
    press(' ', { tagName: 'TEXTAREA', isContentEditable: false });
    press('e', { tagName: 'DIV', isContentEditable: true });
    expect(handlers.onToggleMute).not.toHaveBeenCalled();
    expect(handlers.onPause).not.toHaveBeenCalled();
    expect(handlers.onToggleExpanded).not.toHaveBeenCalled();
  });

  it('Escape closes via onHideShortcuts (not the toggle) when provided', () => {
    const handlers = makeHandlers({
      isOverlayVisible: true,
      onHideShortcuts: jest.fn(),
    });
    render(handlers);
    press('Escape');
    press('?');
    expect(handlers.onHideShortcuts).toHaveBeenCalledTimes(2);
    expect(handlers.onShowShortcuts).not.toHaveBeenCalled();
  });

  it('Space on a focused button is left to the button, other keys still fire', () => {
    const handlers = makeHandlers();
    render(handlers);
    const button: FakeTarget = {
      tagName: 'DIV',
      isContentEditable: false,
      closest: (selector: string) =>
        selector.includes('[role="button"]') ? {} : null,
    };
    const spaceEvent = press(' ', button);
    expect(handlers.onPause).not.toHaveBeenCalled();
    expect(spaceEvent.preventDefault).not.toHaveBeenCalled();
    // Non-activation keys are unaffected by button focus.
    press('m', button);
    press('Escape', button);
    expect(handlers.onToggleMute).toHaveBeenCalledTimes(1);
    expect(handlers.onStop).toHaveBeenCalledTimes(1);
  });
});
