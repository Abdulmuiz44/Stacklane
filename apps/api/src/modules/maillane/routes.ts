import { Hono } from 'hono';
import { authenticateTalocodeApiKey } from '../cloud-billing';

const mailLane = new Hono();

// All routes require TALOCODE_API_KEY
mailLane.use('/*', authenticateTalocodeApiKey);

// In-memory account store (in production, use database)
const accounts: Map<string, any> = new Map();

mailLane.post('/send', async (c) => {
  const body = await c.req.json();
  const { to, subject, text, html, cc, bcc, from: fromAccount, replyTo } = body;

  if (!to || !subject) {
    return c.json({ error: 'to and subject are required' }, 400);
  }

  const projectId = c.get('projectId');
  const account = fromAccount
    ? accounts.get(fromAccount)
    : Array.from(accounts.values()).find((a: any) => a.projectId === projectId);

  if (!account) {
    return c.json({ error: 'No Gmail account connected. Use /auth/url first.' }, 400);
  }

  // In production, use googleapis to send via Gmail
  const messageId = `msg_${Date.now()}`;

  return c.json({
    messageId,
    to: Array.isArray(to) ? to : [to],
    subject,
    accountId: account.id,
    sentAt: new Date().toISOString(),
  });
});

mailLane.get('/accounts', async (c) => {
  const projectId = c.get('projectId');
  const projectAccounts = Array.from(accounts.values())
    .filter((a: any) => a.projectId === projectId)
    .map((a: any) => ({
      id: a.id,
      email: a.email,
      createdAt: a.createdAt,
    }));

  return c.json(projectAccounts);
});

mailLane.get('/stats', async (c) => {
  const projectId = c.get('projectId');
  const account = Array.from(accounts.values())
    .find((a: any) => a.projectId === projectId);

  if (!account) {
    return c.json({ error: 'No account found' }, 404);
  }

  return c.json({
    accountId: account.id,
    email: account.email,
    sentToday: 0,
    dailyLimit: 500,
    remaining: 500,
  });
});

mailLane.get('/auth/url', async (c) => {
  // In production, generate real OAuth URL
  return c.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?client_id=PLACEHOLDER&redirect_uri=PLACEHOLDER&response_type=code&scope=https://mail.google.com/&access_type=offline&prompt=consent`,
  });
});

mailLane.post('/auth/callback', async (c) => {
  const { code } = await c.req.json();
  const projectId = c.get('projectId');

  // In production, exchange code for tokens
  const account = {
    id: `acc_${Date.now()}`,
    projectId,
    email: `user${Date.now()}@gmail.com`,
    accessToken: 'placeholder',
    refreshToken: 'placeholder',
    expiresAt: Date.now() + 3600000,
    createdAt: new Date().toISOString(),
  };

  accounts.set(account.id, account);

  return c.json({
    id: account.id,
    email: account.email,
    createdAt: account.createdAt,
  });
});

mailLane.delete('/accounts/:id', async (c) => {
  const id = c.req.param('id');
  const projectId = c.get('projectId');
  const account = accounts.get(id);

  if (!account || account.projectId !== projectId) {
    return c.json({ error: 'Account not found' }, 404);
  }

  accounts.delete(id);
  return c.json({ removed: true });
});

export default mailLane;
