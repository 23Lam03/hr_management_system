// Test helper: tạo một User + Employee fixture với mật khẩu biết trước
// để dùng trong tests Phase 3.
//
// KHÔNG dùng cho production. KHÔNG tự chạy khi boot server.

import { User } from '../../src/models/index.js';

export const TEST_PASSWORD = 'Test1234!'; // demo password (≥8 ký tự)

/**
 * Tạo một user active với mật khẩu biết trước, trả về { user, password }.
 * @param {object} overrides - field overrides cho User
 */
export async function createTestUser(overrides = {}) {
  const password = overrides.password || TEST_PASSWORD;
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    fullName: overrides.fullName || 'Test User',
    email: overrides.email || `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    passwordHash,
    role: overrides.role || 'employee',
    status: overrides.status || 'active',
  });
  return { user, password };
}

/**
 * Phase 14: create a refresh session and return the FULL pair
 * (accessToken, refreshToken, sessionId, ...). Use this in
 * tests that exercise the refresh / logout / sessions flows.
 */
export async function issueFullSessionFor(user) {
  const { createSessionForUser } = await import('../../src/services/auth.service.js');
  return createSessionForUser(user);
}

/**
 * Backward-compatible: return just the access token string. Existing
 * tests that only need a valid JWT to call /me, /admin-check, etc.
 * use this. Each call still creates a Session document so the token
 * is bound to a real session (Phase 14 invariant).
 */
export async function issueTokenFor(user) {
  const { accessToken } = await issueFullSessionFor(user);
  return accessToken;
}
