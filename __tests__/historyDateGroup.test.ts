/**
 * History grouping must agree with the session store on what "today" means.
 *
 * Session keys come from toDateKey(), which reads local date parts. The
 * grouping used to build its own keys with toISOString().substring(0, 10).
 * Local midnight converted to UTC lands on the previous day for every zone
 * east of UTC, so every session was filed one group too early.
 *
 * The suite runs in Asia/Tokyo (UTC+9, no DST) so the two ways of building a
 * key always disagree.
 */

// Must run before anything constructs a Date.
process.env.TZ = 'Asia/Tokyo';

// MMKV needs native bindings, and uuid ships ESM that jest does not transform.
jest.mock('@/lib/storage', () => ({
  getSessions: () => [],
  saveSessions: () => true,
}));
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

/* eslint-disable @typescript-eslint/no-require-imports */
const { toDateKey } =
  require('@/stores/sessionStore') as typeof import('@/stores/sessionStore');
const { getDateGroup } =
  require('@/app/(tabs)/history') as typeof import('@/app/(tabs)/history');
/* eslint-enable @typescript-eslint/no-require-imports */

function localMidnight(daysAgo: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

describe('getDateGroup in a UTC+ timezone', () => {
  it('runs in Asia/Tokyo, where a local midnight is the previous UTC day', () => {
    const midnight = localMidnight(0);
    expect(toDateKey(midnight)).not.toBe(midnight.toISOString().substring(0, 10));
  });

  it("files today's sessions under Today", () => {
    expect(getDateGroup(toDateKey(localMidnight(0)))).toBe('Today');
  });

  it("files yesterday's sessions under Yesterday", () => {
    expect(getDateGroup(toDateKey(localMidnight(1)))).toBe('Yesterday');
  });

  it('files a session from four weeks ago under Earlier', () => {
    expect(getDateGroup(toDateKey(localMidnight(28)))).toBe('Earlier');
  });
});
