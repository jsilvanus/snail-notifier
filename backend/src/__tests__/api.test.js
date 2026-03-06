import { jest } from '@jest/globals';

process.env.DATABASE_PATH = ':memory:';
process.env.JWT_SECRET = 'test_secret';

const { default: request } = await import('supertest');
const { default: app } = await import('../index.js');

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

  it('creates a QR code', async () => {
    const res = await request(app)
      .post('/api/codes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mailbox 1', type: 'QR', mailbox_label: 'Box 1', contact_email: 'owner@mail.com' });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('QR');
    expect(res.body.qr_data_url).toMatch(/^data:image\/png;base64,/);
    expect(res.body.scan_token).toBeDefined();
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

  it('lists codes', async () => {
    const res = await request(app)
      .get('/api/codes')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects invalid type', async () => {
    const res = await request(app)
      .post('/api/codes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad', type: 'BARCODE' });
    expect(res.status).toBe(400);
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
      .send({ name: 'Scan Box', type: 'QR', contact_email: 'nobody@example.com' });
    scanToken = codeRes.body.scan_token;
  });

  it('returns 200 and records the scan', async () => {
    const res = await request(app).get(`/api/scan/${scanToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Scan recorded');
  });

  it('returns 404 for unknown token', async () => {
    const res = await request(app).get('/api/scan/unknown-token-xxx');
    expect(res.status).toBe(404);
  });
});

describe('VAPID key endpoint', () => {
  it('returns publicKey field', async () => {
    const res = await request(app).get('/api/notifications/vapid-key');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('publicKey');
  });
});

describe('Layouts', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/org/register').send({
      orgName: 'Layout Org', name: 'Admin', email: 'layout@test.org', password: 'layoutpass',
    });
    token = res.body.token;
  });

  it('creates a layout', async () => {
    const res = await request(app)
      .post('/api/layouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ share_code: 'mail-arrived', name: 'Mail Arrived', template: 'Your mail has arrived at {{mailbox}}' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.share_code).toBe('mail-arrived');
  });

  it('rejects duplicate share_code', async () => {
    await request(app)
      .post('/api/layouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ share_code: 'dup-code', name: 'First', template: 'Template 1' });
    const res = await request(app)
      .post('/api/layouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ share_code: 'dup-code', name: 'Second', template: 'Template 2' });
    expect(res.status).toBe(409);
  });

  it('lists layouts', async () => {
    const res = await request(app)
      .get('/api/layouts')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('resolves share_code to layout_id', async () => {
    await request(app)
      .post('/api/layouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ share_code: 'resolve-me', name: 'Resolvable', template: 'Hello' });

    const res = await request(app)
      .post('/api/layouts/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_share_code: 'resolve-me' });
    expect(res.status).toBe(200);
    expect(res.body.layout_id).toBeDefined();
    expect(res.body.share_code).toBe('resolve-me');
  });

  it('returns 404 for unknown share_code in resolve', async () => {
    const res = await request(app)
      .post('/api/layouts/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_share_code: 'does-not-exist' });
    expect(res.status).toBe(404);
  });
});
