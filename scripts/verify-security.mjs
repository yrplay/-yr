import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const server = read('../server.ts');
const context = read('../src/context/AppContext.tsx');
const vercel = JSON.parse(read('../vercel.json'));

const count = (text, pattern) => (text.match(pattern) || []).length;

assert.equal(count(server, /api\.get\('\/health'/g), 1, 'health route must be defined once');
assert.equal(count(server, /api\.post\('\/auth\/login'/g), 1, 'login route must be defined once');
assert.equal(count(server, /api\.get\('\/state'/g), 1, 'state route must be defined once');
assert.ok(server.includes('export default app'), 'Express app must be exported for Vercel');
assert.ok(server.includes("stored.startsWith('scrypt$')"), 'passcodes must support salted hashes');
assert.ok(server.includes("api.get('/auth/users'"), 'login must use the minimal server directory');
assert.ok(server.includes("app.use('/api', (_req, res) => res.status(404)"), 'unknown API routes must return JSON 404');
assert.ok(!server.includes("Access-Control-Allow-Origin', '*'"), 'wildcard CORS must not be enabled');
assert.ok(!server.includes('u.passcode = "1234"'), 'user PIN fallback must not be restored');
assert.ok(!server.includes("passcode: req.body.passcode ? String(req.body.passcode).trim() : '1234'"), 'new users must not receive a default PIN');

assert.ok(!context.includes("import initialData from '../data/initialData'"), 'private seed database must not be imported into the client context');
assert.ok(context.includes("if (res.status === 401)"), 'expired sessions must be handled');
assert.ok(context.includes("localStorage.removeItem(STORAGE_KEY)"), 'private cached state must be cleared on expired sessions');

assert.ok(!vercel.framework, 'Vercel must autodetect the exported Express app instead of forcing Vite static-only mode');
assert.ok(!vercel.rewrites, 'a catch-all SPA rewrite must not swallow API requests');
assert.ok(vercel.buildCommand.includes('cp -R dist/. public/'), 'Vite assets must be staged for Vercel static hosting');

console.log('Static security and deployment guardrails passed.');
