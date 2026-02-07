/**
 * Jest Test Setup for Shelly
 *
 * Global mocks and configuration for all tests.
 */

// Mock the-machina loggers
jest.mock('the-machina', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };

  return {
    loggers: {
      app: mockLogger,
      api: mockLogger,
      auth: mockLogger,
      data: mockLogger,
      channels: mockLogger,
      scheduler: mockLogger,
      metrics: mockLogger
    },
    withRetry: jest.fn().mockImplementation(async (fn) => fn()),
    RetryConfigs: {
      externalApi: jest.fn().mockReturnValue({
        name: 'Test',
        maxAttempts: 1,
        baseDelayMs: 0
      })
    },
    BaseHealthServer: jest.fn().mockImplementation(() => ({
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      getApp: jest.fn().mockReturnValue({})
    }))
  };
});

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Mock response' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 50 }
        })
      }
    }))
  };
});

// Mock Octokit
const mockOctokit = {
  issues: {
    listForRepo: jest.fn().mockResolvedValue({ data: [] }),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    createComment: jest.fn(),
    addLabels: jest.fn(),
    listLabelsForRepo: jest.fn().mockResolvedValue({ data: [] }),
    listMilestones: jest.fn().mockResolvedValue({ data: [] }),
    getMilestone: jest.fn()
  },
  pulls: {
    list: jest.fn().mockResolvedValue({ data: [] }),
    get: jest.fn(),
    listReviews: jest.fn().mockResolvedValue({ data: [] }),
    requestReviewers: jest.fn(),
    listCommits: jest.fn().mockResolvedValue({ data: [] })
  },
  repos: {
    get: jest.fn(),
    listCommits: jest.fn().mockResolvedValue({ data: [] }),
    getContributorsStats: jest.fn().mockResolvedValue({ data: [] }),
    getContent: jest.fn(),
    getCommitActivityStats: jest.fn().mockResolvedValue({ data: [] })
  },
  search: {
    issuesAndPullRequests: jest.fn().mockResolvedValue({ data: { items: [] } }),
    code: jest.fn().mockResolvedValue({ data: { items: [] } })
  }
};

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => mockOctokit)
}));

// Mock pg
const mockPool = {
  query: jest.fn().mockResolvedValue({ rows: [] }),
  end: jest.fn().mockResolvedValue(undefined)
};

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => mockPool)
}));

// Mock redis
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  setEx: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  quit: jest.fn().mockResolvedValue(undefined)
};

jest.mock('redis', () => ({
  createClient: jest.fn().mockReturnValue(mockRedisClient)
}));

// Mock fs for identity files
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn().mockImplementation((path: string) => {
    if (path.includes('IDENTITY.md')) {
      return 'You are Shelly, a helpful GitHub project manager.';
    }
    if (path.includes('SOUL.md')) {
      return 'Be helpful and proactive.';
    }
    if (path.includes('TOOLS.md')) {
      return 'Tool documentation here.';
    }
    throw new Error(`ENOENT: no such file ${path}`);
  })
}));

// Export mocks for use in tests
export { mockOctokit, mockPool, mockRedisClient };
