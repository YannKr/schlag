import type { Config } from 'jest';

// Pin the suite to a UTC+ timezone (Asia/Tokyo, UTC+9, no DST). Date bugs
// where a local midnight is converted to UTC only show up east of UTC, and a
// runner left on UTC would never see them. Set here, before the workers are
// forked, because a per-file assignment does not reach the test sandbox.
process.env.TZ = 'Asia/Tokyo';

const config: Config = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['<rootDir>/__tests__/**/*.test.ts', '<rootDir>/__tests__/**/*.test.tsx'],
};

export default config;
