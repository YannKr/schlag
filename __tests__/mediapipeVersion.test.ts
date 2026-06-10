/**
 * Supply-chain guard: the MediaPipe WASM bundle is fetched at runtime from
 * jsdelivr with a version hardcoded in useCamera.web.ts. If the installed
 * npm package and the CDN URL drift apart, pose detection can break (or
 * silently run a different, unaudited build). This test pins them together.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

describe('MediaPipe version pinning', () => {
  const root = join(__dirname, '..');

  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const declared: string = pkg.dependencies['@mediapipe/tasks-vision'];

  const installed: string = JSON.parse(
    readFileSync(
      join(root, 'node_modules/@mediapipe/tasks-vision/package.json'),
      'utf8',
    ),
  ).version;

  const cameraSource = readFileSync(join(root, 'hooks/useCamera.web.ts'), 'utf8');
  const wasmUrlVersion = cameraSource.match(
    /@mediapipe\/tasks-vision@(\d+\.\d+\.\d+)/,
  )?.[1];

  it('declares an exact version (no ^ or ~ range)', () => {
    expect(declared).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('installed package matches the declared version', () => {
    expect(installed).toBe(declared);
  });

  it('hardcoded WASM CDN URL matches the installed package version', () => {
    expect(wasmUrlVersion).toBe(installed);
  });
});
