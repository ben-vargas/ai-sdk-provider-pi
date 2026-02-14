import { NoSuchModelError } from '@ai-sdk/provider';
import {
  AuthStorage,
  ModelRegistry,
  SessionManager,
  bashTool,
  codingTools,
  createAgentSession,
  editTool,
  findTool,
  grepTool,
  getAgentDir,
  lsTool,
  readTool,
  readOnlyTools,
  writeTool,
  type AgentSession,
} from '@mariozechner/pi-coding-agent';
import { getModel, type Api, type Model } from '@mariozechner/pi-ai';
import { join } from 'node:path';

import {
  DEFAULT_PROVIDER,
  DEFAULT_SESSION_PERSISTENCE,
  DEFAULT_THINKING_LEVEL,
  DEFAULT_TOOL_SET,
} from './constants.js';
import type { Logger, PiModelId, PiSettings, SessionLease } from './types.js';

interface CachedSession {
  session: AgentSession;
  dispose: () => void;
}

export class PiSessionManager {
  private sessions = new Map<string, CachedSession>();

  private sessionQueues = new Map<string, Promise<void>>();

  private sessionCreation = new Map<string, Promise<CachedSession>>();

  private registries = new Map<string, ModelRegistry>();

  private disposed = false;

  private disposePromise?: Promise<void>;

  private readonly cleanupOnExit: () => void;

  constructor() {
    this.cleanupOnExit = () => {
      this.disposeSync();
    };

    process.once('exit', this.cleanupOnExit);
  }

  async getOrCreateSession(
    modelId: PiModelId,
    settings: PiSettings,
    logger: Logger,
  ): Promise<AgentSession> {
    this.assertNotDisposed();
    const lease = await this.getSessionLease(modelId, settings, logger);
    return lease.session;
  }

  async runWithSession<T>(
    modelId: PiModelId,
    settings: PiSettings,
    logger: Logger,
    run: (session: AgentSession) => Promise<T>,
  ): Promise<T> {
    this.assertNotDisposed();
    const lease = await this.getSessionLease(modelId, settings, logger);

    if (lease.sessionId != null) {
      return this.runSerialized(lease.sessionId, () => run(lease.session));
    }

    try {
      return await run(lease.session);
    } finally {
      if (lease.ephemeral) {
        lease.session.dispose();
      }
    }
  }

  async dispose(): Promise<void> {
    if (this.disposePromise != null) {
      await this.disposePromise;
      return;
    }

    this.disposePromise = this.disposeAsync();
    await this.disposePromise;
  }

  private async disposeAsync(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    process.off('exit', this.cleanupOnExit);

    await Promise.allSettled(this.sessionCreation.values());
    await Promise.allSettled(this.sessionQueues.values());

    for (const { dispose } of this.sessions.values()) {
      dispose();
    }

    this.sessions.clear();
    this.sessionQueues.clear();
    this.sessionCreation.clear();
    this.registries.clear();
  }

  private disposeSync(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    process.off('exit', this.cleanupOnExit);

    for (const { dispose } of this.sessions.values()) {
      dispose();
    }

    this.sessions.clear();
    this.sessionQueues.clear();
    this.sessionCreation.clear();
    this.registries.clear();
  }

  private async getSessionLease(
    modelId: PiModelId,
    settings: PiSettings,
    logger: Logger,
  ): Promise<SessionLease> {
    const sessionId = settings.sessionId;

    if (sessionId == null) {
      const session = await this.createSession(modelId, settings, logger, true);
      return {
        session,
        ephemeral: true,
      };
    }

    const existing = this.sessions.get(sessionId);
    if (existing != null) {
      return {
        session: existing.session,
        sessionId,
        ephemeral: false,
      };
    }

    const pendingCreation = this.sessionCreation.get(sessionId);
    if (pendingCreation != null) {
      const created = await pendingCreation;
      return {
        session: created.session,
        sessionId,
        ephemeral: false,
      };
    }

    const creation = this.createSession(modelId, settings, logger, false).then((session) => {
      const cached: CachedSession = {
        session,
        dispose: () => session.dispose(),
      };
      this.sessions.set(sessionId, cached);
      return cached;
    });

    this.sessionCreation.set(sessionId, creation);

    const created = await creation.finally(() => {
      this.sessionCreation.delete(sessionId);
    });

    return {
      session: created.session,
      sessionId,
      ephemeral: false,
    };
  }

  private async createSession(
    modelId: PiModelId,
    settings: PiSettings,
    logger: Logger,
    forceInMemory: boolean,
  ): Promise<AgentSession> {
    const resolvedModel = this.resolveModel(modelId, settings, logger);
    const tools = resolveTools(settings.tools);

    const cwd = settings.cwd ?? process.cwd();
    const persistence = forceInMemory
      ? 'memory'
      : (settings.sessionPersistence ?? DEFAULT_SESSION_PERSISTENCE);

    const sessionManager =
      persistence === 'disk' ? SessionManager.create(cwd) : SessionManager.inMemory(cwd);

    const createOptions = {
      cwd,
      model: resolvedModel,
      thinkingLevel: settings.thinkingLevel ?? DEFAULT_THINKING_LEVEL,
      tools,
      sessionManager,
    } as const;

    const { session } = await createAgentSession(
      settings.agentDir != null
        ? {
            ...createOptions,
            agentDir: settings.agentDir,
          }
        : createOptions,
    );

    return session;
  }

  private resolveModel(modelId: PiModelId, settings: PiSettings, logger: Logger): Model<Api> {
    const parsed = parseModelId(modelId, settings.defaultProvider);
    const registry = this.getModelRegistry(settings.agentDir);

    const fromRegistry = registry.find(parsed.provider, parsed.modelId);
    if (fromRegistry != null) {
      return fromRegistry;
    }

    logger.debug(
      `ModelRegistry.find() did not resolve ${parsed.provider}/${parsed.modelId}; falling back to getModel().`,
    );

    try {
      return getModel(parsed.provider as never, parsed.modelId as never);
    } catch (error) {
      throw new NoSuchModelError({
        modelId: `${parsed.provider}/${parsed.modelId}`,
        modelType: 'languageModel',
        message: `Could not resolve Pi model ${parsed.provider}/${parsed.modelId}: ${String(error)}`,
      });
    }
  }

  private getModelRegistry(agentDir?: string): ModelRegistry {
    const resolvedAgentDir = agentDir ?? getAgentDir();
    const cacheKey = resolvedAgentDir;
    const existing = this.registries.get(cacheKey);
    if (existing != null) {
      return existing;
    }

    const authStorage = new AuthStorage(join(resolvedAgentDir, 'auth.json'));
    const modelRegistry = new ModelRegistry(authStorage, join(resolvedAgentDir, 'models.json'));

    this.registries.set(cacheKey, modelRegistry);
    return modelRegistry;
  }

  private async runSerialized<T>(sessionId: string, run: () => Promise<T>): Promise<T> {
    const previous = this.sessionQueues.get(sessionId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queue = previous.then(() => current);
    this.sessionQueues.set(sessionId, queue);

    await previous;

    try {
      return await run();
    } finally {
      release();
      if (this.sessionQueues.get(sessionId) === queue) {
        this.sessionQueues.delete(sessionId);
      }
    }
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('PiSessionManager has been disposed.');
    }
  }
}

function parseModelId(
  modelId: string,
  defaultProvider?: string,
): {
  provider: string;
  modelId: string;
} {
  const slashIndex = modelId.indexOf('/');
  if (slashIndex === -1) {
    const provider = defaultProvider ?? DEFAULT_PROVIDER;

    if (defaultProvider == null) {
      throw new Error(
        `Model id "${modelId}" is missing provider prefix. Expected provider/model (e.g. anthropic/claude-sonnet-4).`,
      );
    }

    return {
      provider,
      modelId,
    };
  }

  const provider = modelId.slice(0, slashIndex).trim();
  const parsedModelId = modelId.slice(slashIndex + 1).trim();

  if (provider.length === 0 || parsedModelId.length === 0) {
    throw new Error(
      `Model id "${modelId}" is invalid. Expected provider/model with non-empty provider and model ID.`,
    );
  }

  return {
    provider,
    modelId: parsedModelId,
  };
}

function resolveTools(tools: PiSettings['tools']) {
  switch (tools ?? DEFAULT_TOOL_SET) {
    case 'coding':
      return codingTools;
    case 'readOnly':
      return readOnlyTools;
    case 'all':
      return [readTool, bashTool, editTool, writeTool, grepTool, findTool, lsTool];
  }
}
