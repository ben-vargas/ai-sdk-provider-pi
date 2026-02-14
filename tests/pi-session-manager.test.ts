import { describe, expect, it, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  return {
    createAgentSessionMock: vi.fn(),
    findMock: vi.fn(),
    getModelMock: vi.fn(),
    inMemoryMock: vi.fn(),
    createMock: vi.fn(),
    getAgentDirMock: vi.fn(() => '/tmp/pi-agent'),
  };
});

vi.mock('@mariozechner/pi-coding-agent', () => {
  class MockAuthStorage {
    constructor(_path?: string) {
      // no-op
    }
  }

  class MockModelRegistry {
    find(provider: string, modelId: string) {
      return mocks.findMock(provider, modelId);
    }
  }

  class MockSessionManager {
    static inMemory(cwd?: string) {
      return mocks.inMemoryMock(cwd);
    }

    static create(cwd: string) {
      return mocks.createMock(cwd);
    }
  }

  return {
    AuthStorage: MockAuthStorage,
    ModelRegistry: MockModelRegistry,
    SessionManager: MockSessionManager,
    codingTools: [{ name: 'coding' }],
    readOnlyTools: [{ name: 'readOnly' }],
    readTool: { name: 'read' },
    bashTool: { name: 'bash' },
    editTool: { name: 'edit' },
    writeTool: { name: 'write' },
    grepTool: { name: 'grep' },
    findTool: { name: 'find' },
    lsTool: { name: 'ls' },
    createAgentSession: mocks.createAgentSessionMock,
    getAgentDir: mocks.getAgentDirMock,
  };
});

vi.mock('@mariozechner/pi-ai', () => {
  return {
    getModel: mocks.getModelMock,
  };
});

import { PiSessionManager } from '../src/pi-session-manager.js';

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function fakeSession() {
  return {
    dispose: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    prompt: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
  };
}

describe('pi-session-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inMemoryMock.mockReturnValue({ kind: 'memory' });
    mocks.createMock.mockReturnValue({ kind: 'disk' });
    mocks.findMock.mockReturnValue({ provider: 'anthropic', id: 'claude-sonnet-4' });
    mocks.getModelMock.mockReturnValue({ provider: 'anthropic', id: 'claude-sonnet-4' });
    mocks.createAgentSessionMock.mockImplementation(async () => ({ session: fakeSession() }));
  });

  it('caches sessions by sessionId', async () => {
    const manager = new PiSessionManager();

    const s1 = await manager.getOrCreateSession(
      'anthropic/claude-sonnet-4',
      { sessionId: 'a' },
      logger,
    );
    const s2 = await manager.getOrCreateSession(
      'anthropic/claude-sonnet-4',
      { sessionId: 'a' },
      logger,
    );

    expect(s1).toBe(s2);
    expect(mocks.createAgentSessionMock).toHaveBeenCalledTimes(1);
  });

  it('serializes concurrent execution for same sessionId', async () => {
    const manager = new PiSessionManager();
    let active = 0;
    let maxConcurrent = 0;

    const run1 = manager.runWithSession(
      'anthropic/claude-sonnet-4',
      { sessionId: 'same' },
      logger,
      async () => {
        active += 1;
        maxConcurrent = Math.max(maxConcurrent, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active -= 1;
      },
    );

    const run2 = manager.runWithSession(
      'anthropic/claude-sonnet-4',
      { sessionId: 'same' },
      logger,
      async () => {
        active += 1;
        maxConcurrent = Math.max(maxConcurrent, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
      },
    );

    await Promise.all([run1, run2]);

    expect(maxConcurrent).toBe(1);
    expect(mocks.createAgentSessionMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to getModel when registry misses', async () => {
    mocks.findMock.mockReturnValue(undefined);

    const manager = new PiSessionManager();
    await manager.getOrCreateSession('anthropic/claude-sonnet-4', {}, logger);

    expect(mocks.getModelMock).toHaveBeenCalledWith('anthropic', 'claude-sonnet-4');
  });

  it('requires explicit defaultProvider for model ids without provider prefix', async () => {
    const manager = new PiSessionManager();

    await expect(manager.getOrCreateSession('claude-sonnet-4', {}, logger)).rejects.toThrow(
      'missing provider prefix',
    );
  });

  it('disposes cached sessions', async () => {
    const manager = new PiSessionManager();

    const session = await manager.getOrCreateSession(
      'anthropic/claude-sonnet-4',
      { sessionId: 'd' },
      logger,
    );
    await manager.dispose();

    expect(session.dispose).toHaveBeenCalledTimes(1);
  });

  it('waits for in-flight serialized runs before disposing cached sessions', async () => {
    const manager = new PiSessionManager();
    const session = fakeSession();
    mocks.createAgentSessionMock.mockImplementationOnce(async () => ({ session }));

    let releaseRun!: () => void;
    const runBlocked = new Promise<void>((resolve) => {
      releaseRun = resolve;
    });
    let runStarted!: () => void;
    const runStartedPromise = new Promise<void>((resolve) => {
      runStarted = resolve;
    });

    const runPromise = manager.runWithSession(
      'anthropic/claude-sonnet-4',
      { sessionId: 'in-flight' },
      logger,
      async () => {
        runStarted();
        await runBlocked;
      },
    );

    await runStartedPromise;

    let disposeResolved = false;
    const disposePromise = manager.dispose().then(() => {
      disposeResolved = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(disposeResolved).toBe(false);
    expect(session.dispose).not.toHaveBeenCalled();

    releaseRun();
    await runPromise;
    await disposePromise;

    expect(session.dispose).toHaveBeenCalledTimes(1);
  });
});
