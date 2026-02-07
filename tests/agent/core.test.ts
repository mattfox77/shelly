/**
 * Agent Core Tests
 *
 * Tests for the Shelly AI agent core functionality.
 */

import { Agent, Tool, AgentConfig } from '../../src/agent/core';
import Anthropic from '@anthropic-ai/sdk';

// Get the mocked Anthropic
const MockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

describe('Agent', () => {
  let agent: Agent;
  let mockMessagesCreate: jest.Mock;

  const testConfig: AgentConfig = {
    model: 'claude-sonnet-4-20250514',
    apiKey: 'test-api-key',
    workspacePath: '/test/workspace'
  };

  const testTools: Tool[] = [
    {
      name: 'list_issues',
      description: 'List issues from a repository',
      input_schema: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: 'Repository name' }
        },
        required: ['repo']
      }
    }
  ];

  beforeEach(async () => {
    agent = new Agent();

    // Get the mock from the Anthropic constructor
    mockMessagesCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Test response' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 }
    });

    // Reset and set up the mock
    MockedAnthropic.mockClear();
    MockedAnthropic.mockImplementation(() => ({
      messages: {
        create: mockMessagesCreate
      }
    } as unknown as Anthropic));

    await agent.init(testConfig);
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should initialize the agent', async () => {
      const newAgent = new Agent();
      await newAgent.init(testConfig);
      expect(newAgent).toBeDefined();
    });

    it('should load identity files', async () => {
      const newAgent = new Agent();
      await newAgent.init(testConfig);
      // Identity files are loaded via fs mock in setup.ts
      expect(newAgent).toBeDefined();
    });

    it('should use default identity if files not found', async () => {
      const fs = require('fs');
      fs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const newAgent = new Agent();
      await newAgent.init(testConfig);
      expect(newAgent).toBeDefined();
    });
  });

  describe('process', () => {
    it('should process a simple message', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hello! I can help you manage your GitHub projects.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 50, output_tokens: 20 }
      });

      const response = await agent.process('Hello!');

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: testConfig.model,
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'Hello!' })
          ])
        })
      );
      expect(response.content).toHaveLength(1);
      expect(response.stop_reason).toBe('end_turn');
    });

    it('should pass tools to the API', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'I can list your issues.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 30 }
      });

      await agent.process('List my issues', testTools);

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: testTools
        })
      );
    });

    it('should handle tool use', async () => {
      // First response requests tool use
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'Let me list the issues for you.' },
          {
            type: 'tool_use',
            id: 'tool-123',
            name: 'list_issues',
            input: { repo: 'owner/repo' }
          }
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 }
      });

      // Second response after tool result
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Here are the issues: Issue 1, Issue 2' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 150, output_tokens: 30 }
      });

      const toolHandlers = {
        list_issues: jest.fn().mockResolvedValue([
          { number: 1, title: 'Issue 1' },
          { number: 2, title: 'Issue 2' }
        ])
      };

      const response = await agent.process(
        'List issues for owner/repo',
        testTools,
        toolHandlers
      );

      expect(toolHandlers.list_issues).toHaveBeenCalledWith({ repo: 'owner/repo' });
      expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
      expect(response.stop_reason).toBe('end_turn');
    });

    it('should handle tool execution errors', async () => {
      // First response requests tool use
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tool-123',
            name: 'list_issues',
            input: { repo: 'owner/repo' }
          }
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 }
      });

      // Second response after error
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'I encountered an error listing the issues.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 150, output_tokens: 30 }
      });

      const toolHandlers = {
        list_issues: jest.fn().mockRejectedValue(new Error('API rate limited'))
      };

      const response = await agent.process(
        'List issues',
        testTools,
        toolHandlers
      );

      expect(response.stop_reason).toBe('end_turn');
    });

    it('should handle unknown tools gracefully', async () => {
      // Response requests unknown tool
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tool-123',
            name: 'unknown_tool',
            input: {}
          }
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 }
      });

      // Response after error
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'That tool is not available.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 150, output_tokens: 30 }
      });

      const toolHandlers = {
        list_issues: jest.fn()
      };

      await agent.process('Do something unknown', testTools, toolHandlers);

      // Should not call list_issues for unknown_tool
      expect(toolHandlers.list_issues).not.toHaveBeenCalled();
    });

    it('should use custom max tokens', async () => {
      const customAgent = new Agent();

      MockedAnthropic.mockImplementation(() => ({
        messages: {
          create: mockMessagesCreate
        }
      } as unknown as Anthropic));

      await customAgent.init({ ...testConfig, maxTokens: 8192 });

      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 50, output_tokens: 20 }
      });

      await customAgent.process('Test');

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 8192
        })
      );
    });
  });

  describe('getConversationHistory', () => {
    it('should return conversation history', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hello!' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 50, output_tokens: 20 }
      });

      await agent.process('Hi');

      const history = agent.getConversationHistory();

      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });

    it('should return a copy of history', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hello!' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 50, output_tokens: 20 }
      });

      await agent.process('Hi');

      const history1 = agent.getConversationHistory();
      const history2 = agent.getConversationHistory();

      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe('clearConversationHistory', () => {
    it('should clear conversation history', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hello!' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 50, output_tokens: 20 }
      });

      await agent.process('Hi');
      expect(agent.getConversationHistory().length).toBeGreaterThan(0);

      agent.clearConversationHistory();

      expect(agent.getConversationHistory()).toHaveLength(0);
    });
  });

  describe('reloadIdentity', () => {
    it('should reload identity files', async () => {
      const fs = require('fs');
      const initialCalls = fs.readFileSync.mock.calls.length;

      await agent.reloadIdentity();

      // Should have called readFileSync for identity files
      expect(fs.readFileSync.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });
});
