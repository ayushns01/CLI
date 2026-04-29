/**
 * Provider-agnostic LLM adapter.
 * Defines a clean interface for LLM completion that can be swapped between
 * different providers (OpenAI, Anthropic, etc.) without changing the runtime.
 */

/**
 * A simple interface for any LLM provider.
 * Implementations should handle model selection, API keys, etc.
 */
export interface LLMProvider {
  complete(prompt: string): Promise<string>;
}

/**
 * MockProvider for testing.
 * Returns scripted responses based on prompt patterns without making real API calls.
 */
export class MockProvider implements LLMProvider {
  private patterns: Array<[RegExp | string, string]> = [];

  constructor(scripts?: Record<string, string>) {
    if (scripts) {
      Object.entries(scripts).forEach(([key, value]) => {
        // Try to parse the key as a regex if it looks like one
        if (key.startsWith("/") && key.lastIndexOf("/") > 0) {
          const lastSlash = key.lastIndexOf("/");
          const pattern = key.slice(1, lastSlash);
          const flags = key.slice(lastSlash + 1);
          try {
            this.patterns.push([new RegExp(pattern, flags), value]);
          } catch {
            this.patterns.push([key, value]);
          }
        } else {
          this.patterns.push([key, value]);
        }
      });
    }
  }

  async complete(prompt: string): Promise<string> {
    // Try exact match first
    for (const [key, value] of this.patterns) {
      if (typeof key === "string" && key === prompt) {
        return value;
      }
    }

    // Try regex match
    for (const [key, value] of this.patterns) {
      if (key instanceof RegExp && key.test(prompt)) {
        return value;
      }
    }

    // Default fallback
    return JSON.stringify({
      steps: [
        {
          tool: "noop",
          args: {}
        }
      ]
    });
  }

  /**
   * Convenience method to set a response for a prompt pattern.
   */
  setResponse(pattern: string | RegExp, response: string): void {
    this.patterns.push([pattern, response]);
  }
}

/**
 * Default mock provider for testing.
 */
export const createMockProvider = (scripts?: Record<string, string>): MockProvider => {
  return new MockProvider(scripts);
};
