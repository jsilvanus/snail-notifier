'use strict';

process.env.DATABASE_PATH = ':memory:';
process.env.JWT_SECRET = 'test_secret';
process.env.CONSENT_JWT_SECRET = 'test_consent_secret';

const request = require('supertest');
const app = require('../index');

describe('Health', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Auth - Org', () => {
  it('registers a new organisation', async () => {
    const res = await request(app).post('/api/auth/org/register').send({
      orgName: 'Test Org',
      name: 'Admin User',
      email: 'admin@test.org',
      password: 'secret123',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.role).toBe('admin');
  });

  it('rejects duplicate org email', async () => {
    await request(app).post('/api/auth/org/register').send({
      orgName: 'Dup Org', name: 'Admin', email: 'dup@test.org', password: 'secret',
    });
    const res = await request(app).post('/api/auth/org/register').send({
      orgName: 'Dup Org2', name: 'Admin2', email: 'dup@test.org', password: 'secret',
    });
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/org/register').send({
      orgName: 'Login Org', name: 'Admin', email: 'login@test.org', password: 'pass1234',
    });
    const res = await request(app).post('/api/auth/org/login').send({
      email: 'login@test.org', password: 'pass1234',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects wrong password', async () => {
    await request(app).post('/api/auth/org/register').send({
      orgName: 'Wrong Org', name: 'Admin', email: 'wrong@test.org', password: 'correct',
    });
    const res = await request(app).post('/api/auth/org/login').send({
      email: 'wrong@test.org', password: 'incorrect',
    });
    expect(res.status).toBe(401);
  });
});

describe('Auth - End User', () => {
  it('registers and logs in', async () => {
    const reg = await request(app).post('/api/auth/user/register').send({
      email: 'mailowner@example.com', password: 'mypass',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeDefined();

    const login = await request(app).post('/api/auth/user/login').send({
      email: 'mailowner@example.com', password: 'mypass',
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeDefined();
  });
});

describe('Codes', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/org/register').send({
      orgName: 'Code Org', name: 'Coder', email: 'coder@test.org', password: 'codepass',
    });
    token = res.body.token;
  });

  it('creates a QR code (simple)', async () => {
    const res = await request(app)
      .post('/api/codes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mailbox 1', type: 'QR', mailbox_label: 'Box 1' });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('QR');
    expect(res.body.behavior).toBe('simple');
    expect(res.body.qr_data_url).toMatch(/^data:image\/png;base64,/);
    expect(res.body.scan_token).toBeDefined();
  });

  it('creates a data_input QR code', async () => {
    const res = await request(app)
      .post('/api/codes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Input Box', type: 'QR', behavior: 'data_input', mailbox_label: 'Data Box' });
    expect(res.status).toBe(201);
    expect(res.body.behavior).toBe('data_input');
  });

  it('creates an NFC code (no QR image)', async () => {
    const res = await request(app)
      .post('/api/codes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mailbox NFC', type: 'NFC', mailbox_label: 'NFC Box' });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('NFC');
    expect(res.body.qr_data_url).toBeNull();
  });

  it('lists codes with member counts', async () => {
    const res = await request(app)
      .get('/api/codes')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0]).toHaveProperty('member_count');
    expect(res.body[0]).toHaveProperty('pending_invites');
  });

  it('rejects invalid type', async () => {
    const res = await request(app)
      .post('/api/codes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad', type: 'BARCODE' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid behavior', async () => {
    const res = await request(app)
      .post('/api/codes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad', type: 'QR', behavior: 'magic' });
    expect(res.status).toBe(400);
  });
});

describe('Input fields', () => {
  let orgToken, codeId;

  beforeAll(async () => {
    const org = await request(app).post('/api/auth/org/register').send({
      orgName: 'Field Org', name: 'Admin', email: 'fields@test.org', password: 'pass',
    });
    orgToken = org.body.token;
    const code = await request(app).post('/api/codes')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ name: 'Input Code', type: 'NFC', behavior: 'data_input' });
    codeId = code.body.id;
  });

  it('adds a field to a data_input code', async () => {
    const res = await request(app)
      .post(`/api/codes/${codeId}/fields`)
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ label: 'Your name', placeholder: 'Alice', field_type: 'text', required: true });
    expect(res.status).toBe(201);
    expect(res.body.label).toBe('Your name');
  });

  it('lists fields', async () => {
    const res = await request(app)
      .get(`/api/codes/${codeId}/fields`)
      .set('Authorization', `Bearer ${orgToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  it('rejects adding fields to a simple code', async () => {
    const simple = await request(app).post('/api/codes')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ name: 'Simple', type: 'NFC', behavior: 'simple' });
    const res = await request(app)
      .post(`/api/codes/${simple.body.id}/fields`)
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ label: 'Test' });
    expect(res.status).toBe(400);
  });
});

describe('Token invite & consent flow', () => {
  let orgToken, codeId, userToken, consentJwt;

  beforeAll(async () => {
    const org = await request(app).post('/api/auth/org/register').send({
      orgName: 'Consent Org', name: 'Admin', email: 'consent@test.org', password: 'pass',
    });
    orgToken = org.body.token;

    const code = await request(app).post('/api/codes')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ name: 'Consent Token', type: 'QR' });
    codeId = code.body.id;

    const user = await request(app).post('/api/auth/user/register').send({
      email: 'consentuser@example.com', password: 'userpass',
    });
    userToken = user.body.token;
  });

  it('invites a user to a token', async () => {
    const res = await request(app)
      .post(`/api/tokens/${codeId}/invite`)
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ email: 'consentuser@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.membershipId).toBeDefined();
  });

  it('rejects duplicate pending invite', async () => {
    const res = await request(app)
      .post(`/api/tokens/${codeId}/invite`)
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ email: 'consentuser@example.com' });
    expect(res.status).toBe(409);
  });

  it('end-user sees pending membership', async () => {
    const res = await request(app)
      .get('/api/memberships')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].status).toBe('pending');
    // Extract consent token from DB for subsequent tests
    const db = require('../db');
    const membership = db.prepare('SELECT consent_token FROM token_memberships').get();
    consentJwt = membership.consent_token;
  });

  it('accept link sets status to accepted', async () => {
    const res = await request(app).get(`/api/consent/${consentJwt}/accept`);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/activated/i);
  });

  it('membership is accepted after clicking accept', async () => {
    const res = await request(app)
      .get('/api/memberships')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('accepted');
  });

  it('end-user can pause a membership', async () => {
    const memberships = await request(app).get('/api/memberships').set('Authorization', `Bearer ${userToken}`);
    const id = memberships.body[0].id;
    const res = await request(app)
      .patch(`/api/memberships/${id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ paused: true });
    expect(res.status).toBe(200);
  });

  it('end-user can leave a token', async () => {
    const memberships = await request(app).get('/api/memberships').set('Authorization', `Bearer ${userToken}`);
    const id = memberships.body[0].id;
    const res = await request(app)
      .delete(`/api/memberships/${id}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
  });
});

describe('Scan endpoint', () => {
  let scanToken;

  beforeAll(async () => {
    const orgRes = await request(app).post('/api/auth/org/register').send({
      orgName: 'Scan Org', name: 'Scanner', email: 'scan@test.org', password: 'scanpass',
    });
    const codeRes = await request(app)
      .post('/api/codes')
      .set('Authorization', `Bearer ${orgRes.body.token}`)
      .send({ name: 'Scan Box', type: 'QR' });
    scanToken = codeRes.body.scan_token;
  });

  it('returns 200 and records the scan (no members)', async () => {
    const res = await request(app).get(`/api/scan/${scanToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Scan recorded');
  });

  it('returns 404 for unknown token', async () => {
    const res = await request(app).get('/api/scan/unknown-token-xxx');
    expect(res.status).toBe(404);
  });

  it('data_input GET returns fields', async () => {
    const orgRes = await request(app).post('/api/auth/org/register').send({
      orgName: 'Di Org', name: 'Admin', email: 'di@test.org', password: 'pass',
    });
    const code = await request(app).post('/api/codes')
      .set('Authorization', `Bearer ${orgRes.body.token}`)
      .send({ name: 'DI Code', type: 'QR', behavior: 'data_input' });
    await request(app).post(`/api/codes/${code.body.id}/fields`)
      .set('Authorization', `Bearer ${orgRes.body.token}`)
      .send({ label: 'Your name' });
    const res = await request(app).get(`/api/scan/${code.body.scan_token}`);
    expect(res.status).toBe(200);
    expect(res.body.behavior).toBe('data_input');
    expect(Array.isArray(res.body.fields)).toBe(true);
    expect(res.body.fields[0].label).toBe('Your name');
  });
});

describe('VAPID key endpoint', () => {
  it('returns publicKey field', async () => {
    const res = await request(app).get('/api/notifications/vapid-key');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('publicKey');
  });
});

describe('Channel prefs and user channels', () => {
  let userToken, membershipId;

  beforeAll(async () => {
    // Set up org, token, and accepted membership
    const org = await request(app).post('/api/auth/org/register').send({
      orgName: 'Chan Org', name: 'Admin', email: 'chan@test.org', password: 'pass',
    });
    const code = await request(app).post('/api/codes')
      .set('Authorization', `Bearer ${org.body.token}`)
      .send({ name: 'Chan Token', type: 'QR' });

    const user = await request(app).post('/api/auth/user/register').send({
      email: 'chanuser@example.com', password: 'pass',
    });
    userToken = user.body.token;

    await request(app).post(`/api/tokens/${code.body.id}/invite`)
      .set('Authorization', `Bearer ${org.body.token}`)
      .send({ email: 'chanuser@example.com' });

    const db = require('../db');
    const mem = db.prepare("SELECT * FROM token_memberships WHERE status='pending'").get();
    // Auto-accept for test
    db.prepare("UPDATE token_memberships SET status='accepted' WHERE id=?").run(mem.id);
    membershipId = mem.id;
  });

  it('sets channel prefs for a membership', async () => {
    const res = await request(app)
      .put(`/api/memberships/${membershipId}/channels`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ channels: [{ channel: 'push', enabled: true }, { channel: 'email', enabled: false }] });
    expect(res.status).toBe(200);
  });

  it('gets channel prefs', async () => {
    const res = await request(app)
      .get(`/api/memberships/${membershipId}/channels`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('saves user channel contact info', async () => {
    const res = await request(app)
      .put('/api/users/me/channels')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ channel: 'sms', value: '+15550001234' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('lists user channel contact info', async () => {
    const res = await request(app)
      .get('/api/users/me/channels')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.find(c => c.channel === 'sms')).toBeDefined();
  });
});
