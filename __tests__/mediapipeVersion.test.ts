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

describe('MediaPipe integrity and CSP', () => {
  const root = join(__dirname, '..');
  const cameraSource = readFileSync(join(root, 'hooks/useCamera.web.ts'), 'utf8');
  const headers = readFileSync(join(root, 'public/_headers'), 'utf8');
  const csp =
    headers.match(/Content-Security-Policy: (.*)/)?.[1] ?? '';

  const wasmPath =
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm/';
  const modelPath =
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

  it('pins a SHA-384 digest for the pose model', () => {
    expect(cameraSource).toMatch(/MODEL_SRI\s*=\s*\n?\s*'sha384-[A-Za-z0-9+/]{64}'/);
  });

  it('verifies the model itself instead of letting MediaPipe fetch it', () => {
    expect(cameraSource).toContain('modelAssetBuffer:');
    expect(cameraSource).not.toContain('modelAssetPath:');
  });

  it('allow-lists the exact CDN path, never the whole jsdelivr host', () => {
    expect(csp).toContain(wasmPath);
    // A bare host source would let any package on the CDN through.
    expect(csp).not.toMatch(/https:\/\/cdn\.jsdelivr\.net(?![/\w])/);
  });

  it('allow-lists the exact model URL, never the whole storage host', () => {
    expect(csp).toContain(modelPath);
    expect(csp).not.toMatch(/https:\/\/storage\.googleapis\.com(?![/\w])/);
  });

  it('does not allow the CDN as a style or font source', () => {
    const styleSrc = csp.match(/style-src ([^;]*)/)?.[1] ?? '';
    const fontSrc = csp.match(/font-src ([^;]*)/)?.[1] ?? '';
    expect(styleSrc).not.toContain('jsdelivr');
    expect(fontSrc).not.toContain('jsdelivr');
  });
});
