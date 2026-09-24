/**
 * Native ToneGenerator (expo-audio + expo-file-system) integration contract.
 */

type Listener = (status: { isLoaded: boolean }) => void;

interface FakePlayer {
  uri: string;
  options: unknown;
  isLoaded: boolean;
  currentTime: number;
  volume: number;
  listeners: Listener[];
  calls: string[];
  addListener: jest.Mock;
  seekTo: jest.Mock;
  play: jest.Mock;
  remove: jest.Mock;
  release: jest.Mock;
}

const mockPlayers: FakePlayer[] = [];
const mockWrites: string[] = [];
const mockSetAudioModeAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-audio', () => ({
  setAudioModeAsync: (...args: unknown[]) => mockSetAudioModeAsync(...args),
  createAudioPlayer: (source: { uri: string }, options: unknown) => {
    const player: FakePlayer = {
      uri: source.uri,
      options,
      isLoaded: false,
      currentTime: 0,
      volume: 1,
      listeners: [],
      calls: [],
      addListener: jest.fn((_event: string, cb: Listener) => {
        player.listeners.push(cb);
        return { remove: () => (player.listeners = player.listeners.filter((l) => l !== cb)) };
      }),
      seekTo: jest.fn(async () => {
        player.calls.push('seekTo');
      }),
      play: jest.fn(() => player.calls.push('play')),
      remove: jest.fn(),
      release: jest.fn(),
    };
    mockPlayers.push(player);
    return player;
  },
}));

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    }
    create() {}
  }
  class File {
    uri: string;
    constructor(dir: { uri: string }, name: string) {
      this.uri = `${dir.uri}/${name}`;
    }
    write() {
      mockWrites.push(this.uri);
    }
  }
  return { Directory, File, Paths: { cache: { uri: 'file:///cache' } } };
});

import { ToneGenerator } from '@/lib/audio/toneGenerator';

/** Initialize, then mark every player loaded so initialize() resolves. */
async function initLoaded(gen: ToneGenerator): Promise<void> {
  const pending = gen.initialize();
  await Promise.resolve();
  await Promise.resolve();
  for (const p of mockPlayers) {
    p.isLoaded = true;
    p.listeners.forEach((l) => l({ isLoaded: true }));
  }
  await pending;
}

beforeEach(() => {
  mockPlayers.length = 0;
  mockWrites.length = 0;
  mockSetAudioModeAsync.mockClear();
});

describe('ToneGenerator (native)', () => {
  it('plays in silent mode and mixes with other audio', async () => {
    await initLoaded(new ToneGenerator());
    expect(mockSetAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
    });
  });

  it('writes one WAV file and creates one session-keeping player per tone', async () => {
    await initLoaded(new ToneGenerator());
    expect(mockWrites).toHaveLength(8);
    expect(mockPlayers).toHaveLength(8);
    expect(mockPlayers.map((p) => p.uri)).toEqual(mockWrites);
    for (const p of mockPlayers) {
      expect(p.uri).toMatch(/^file:\/\/\/cache\/schlag-tones\/\w+\.wav$/);
      expect(p.options).toEqual({ keepAudioSessionActive: true });
    }
  });

  it('waits for players to load before resolving initialize()', async () => {
    const gen = new ToneGenerator();
    let resolved = false;
    const pending = gen.initialize().then(() => (resolved = true));
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);
    mockPlayers.forEach((p) => p.listeners.forEach((l) => l({ isLoaded: true })));
    await pending;
    expect(resolved).toBe(true);
  });

  it('does not seek a player that has not loaded', async () => {
    const gen = new ToneGenerator();
    await initLoaded(gen);
    const player = mockPlayers[0];
    player.isLoaded = false;
    player.currentTime = 0.05;
    await gen.playTone('intervalStart');
    expect(player.seekTo).not.toHaveBeenCalled();
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('rewinds a played tone, applies volume, then plays', async () => {
    const gen = new ToneGenerator();
    await initLoaded(gen);
    const player = mockPlayers[0];
    player.currentTime = 0.08;
    await gen.playTone('intervalStart', 0.4);
    expect(player.calls).toEqual(['seekTo', 'play']);
    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.volume).toBe(0.4);
  });

  it('removes and releases every player on cleanup', async () => {
    const gen = new ToneGenerator();
    await initLoaded(gen);
    await gen.cleanup();
    for (const p of mockPlayers) {
      expect(p.remove).toHaveBeenCalledTimes(1);
      expect(p.release).toHaveBeenCalledTimes(1);
    }
  });
});
