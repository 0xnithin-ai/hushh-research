// __tests__/setup.ts

/**
 * Vitest Test Setup
 *
 * Configures mock environment for API route testing.
 */

import { vi } from "vitest";

// Mock environment variables for testing
process.env.NEXT_PUBLIC_APP_ENV = "development";
process.env.BACKEND_URL = "http://127.0.0.1:8000";
process.env.NODE_ENV = "test";

// Mock fetch globally
global.fetch = vi.fn();

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
