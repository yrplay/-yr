import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';

const tempDir = mkdtempSync(path.join(tmpdir(), 'ghaith-api-test-'));
const databasePath = path.join(tempDir, 'database.json');
copyFileSync(new URL('../data/database.json', import.meta.url), databasePath);

process.env.DATABASE_FILE = databasePath;
process.env.SESSION_SECRET = 'ci-test-session-secret-with-more-than-32-characters';
process.env.GHAYM_INITIAL_LEADER_PASSCODE = 'Leader-Bootstrap-9876';
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

let server;
try {
  const { default: app } = await import('../server.ts');
  server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = 'http://127.0.0.1:' + address.port;
  const request = (route, init = {}, cookie) => {
    const headers = new Headers(init.headers || {});
    if (cookie) headers.set('Cookie', cookie);
    return fetch(baseUrl + route, { ...init, headers });
  };

  const anonymousState = await request('/api/state');
  assert.equal(anonymousState.status, 401, 'private state must require authentication');

  const directoryResponse = await request('/api/auth/users');
  assert.equal(directoryResponse.status, 200);
  const directory = await directoryResponse.json();
  assert.ok(directory.some(user => user.id === 'u-1'));
  assert.ok(!JSON.stringify(directory).includes('phone'), 'public login directory must not include contact fields');
  assert.ok(!JSON.stringify(directory).includes('email'), 'public login directory must not include email addresses');

  const badLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'u-1', passcode: 'incorrect-passcode' })
  });
  assert.equal(badLogin.status, 401, 'invalid credentials must be rejected');

  const loginResponse = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'u-1', passcode: process.env.GHAYM_INITIAL_LEADER_PASSCODE })
  });
  assert.equal(loginResponse.status, 200, 'configured bootstrap credential should establish the first leader session');
  const leaderCookie = (loginResponse.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(leaderCookie.startsWith('ghaith_session='));
  assert.ok(!JSON.stringify(await loginResponse.json()).includes('passcode'));

  const stateResponse = await request('/api/state', {}, leaderCookie);
  assert.equal(stateResponse.status, 200);
  const state = await stateResponse.json();
  assert.ok(state.students.length > 0);
  assert.ok(!JSON.stringify(state).includes('scrypt$'), 'state must not expose password hashes');
  assert.ok(!Object.hasOwn(state.settings, 'leaderPasscode'), 'state must not expose the leader PIN');

  const backupResponse = await request('/api/backup/download', {}, leaderCookie);
  assert.equal(backupResponse.status, 200);
  const backup = await backupResponse.text();
  assert.ok(!backup.includes('scrypt$'), 'downloaded backup must not expose password hashes');

  const createUserResponse = await request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'CI Scoped Teacher',
      role: 'teacher',
      title: 'Teacher',
      circleIds: ['c-1'],
      passcode: 'Teacher-Pass-9876'
    })
  }, leaderCookie);
  assert.equal(createUserResponse.status, 201);
  const createdUser = await createUserResponse.json();
  assert.ok(createdUser.id);
  assert.ok(!Object.hasOwn(createdUser, 'passcode'), 'user creation response must redact credentials');

  const teacherLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: createdUser.id, passcode: 'Teacher-Pass-9876' })
  });
  assert.equal(teacherLogin.status, 200, 'new user PIN must be hashed and verifiable');
  const teacherCookie = (teacherLogin.headers.get('set-cookie') || '').split(';')[0];

  const teacherStateResponse = await request('/api/state', {}, teacherCookie);
  assert.equal(teacherStateResponse.status, 200);
  const teacherState = await teacherStateResponse.json();
  assert.ok(teacherState.circles.every(circle => circle.id === 'c-1'), 'teacher state must be circle-scoped');
  assert.ok(teacherState.students.every(student => student.circleId === 'c-1'), 'teacher state must not expose other circles’ students');

  const deniedSettings = await request('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Should Not Change' })
  }, teacherCookie);
  assert.equal(deniedSettings.status, 403, 'teachers must not change global settings');

  const deniedAttendance = await request('/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 's-6', circleId: 'c-2', date: '2099-01-01', status: 'present' })
  }, teacherCookie);
  assert.equal(deniedAttendance.status, 403, 'teachers must not write attendance for another circle');

  const logout = await request('/api/auth/logout', { method: 'POST' }, teacherCookie);
  assert.equal(logout.status, 200);
  const afterLogout = await request('/api/state', {}, teacherCookie);
  assert.equal(afterLogout.status, 401, 'logout must invalidate the browser cookie');

  const storedDb = JSON.parse(readFileSync(databasePath, 'utf8'));
  assert.ok(storedDb.users.find(user => user.id === 'u-1').passcode.startsWith('scrypt$'), 'first login must migrate the leader PIN to a salted hash');
  assert.ok(storedDb.users.find(user => user.id === createdUser.id).passcode.startsWith('scrypt$'), 'new PINs must be stored as salted hashes');

  console.log('API integration checks passed: auth, redaction, scoped access, logout, and PIN hashing.');
} finally {
  if (server?.listening) {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
  }
  rmSync(tempDir, { recursive: true, force: true });
}
