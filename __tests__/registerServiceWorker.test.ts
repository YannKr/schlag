/**
 * Unit tests for lib/registerServiceWorker — guard conditions and the
 * registration call.
 *
 * The service worker itself (public/sw.js) cannot run in jest; these tests
 * cover the registration wrapper: web-production-only gating, missing
 * browser support, and the never-throw guarantee on registration failure.
 */

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports)
// ---------------------------------------------------------------------------

let mockPlatformOS: 'ios' | 'android' | 'web' = 'web';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

import { registerServiceWorker } from '@/lib/registerServiceWorker';

// ---------------------------------------------------------------------------
// Globals: __DEV__ and navigator stubs
// ---------------------------------------------------------------------------

const g = globalThis as Record<string, unknown>;
const originalDev = g.__DEV__;
const hadNavigator = 'navigator' in g;
const originalNavigator = g.navigator;

const mockRegister = jest.fn<Promise<unknown>, [string]>();

function stubNavigator(value: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    value,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatformOS = 'web';
  g.__DEV__ = false; // production by default
  mockRegister.mockResolvedValue({});
  stubNavigator({ serviceWorker: { register: mockRegister } });
});

afterAll(() => {
  g.__DEV__ = originalDev;
  if (hadNavigator) {
    stubNavigator(originalNavigator);
  } else {
    delete g.navigator;
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerServiceWorker', () => {
  it('registers /sw.js on web in production', () => {
    registerServiceWorker();
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenCalledWith('/sw.js');
  });

  it('is a no-op on native platforms', () => {
    mockPlatformOS = 'ios';
    registerServiceWorker();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('is a no-op in development', () => {
    g.__DEV__ = true;
    registerServiceWorker();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('is a no-op when the browser has no service worker support', () => {
    stubNavigator({}); // no `serviceWorker` key
    expect(() => registerServiceWorker()).not.toThrow();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('swallows registration failures (offline support is best-effort)', async () => {
    mockRegister.mockRejectedValue(new Error('quota exceeded'));
    expect(() => registerServiceWorker()).not.toThrow();
    // Flush the rejected promise chain — the .catch() must absorb it.
    await Promise.resolve();
    await Promise.resolve();
    expect(mockRegister).toHaveBeenCalledWith('/sw.js');
  });
});
