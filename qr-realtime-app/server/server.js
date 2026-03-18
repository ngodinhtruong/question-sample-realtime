const http = require('http');
const express = require('express');
const path = require('path');
const socket = require('./socket');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/sender/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^\d{6}$/.test(id)) {
    return res.redirect('/sender.html');
  }
  try {
    const session = await db.getSession(id);
    if (!session) {
      return res.redirect('/sender.html');
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'sender.html'));
  } catch (err) {
    res.redirect('/sender.html');
  }
});

function makeSessionId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/api/sessions', async (req, res) => {
  let sessionId;
  for (let i = 0; i < 5; i++) {
    sessionId = makeSessionId();
    const exists = await db.getSession(sessionId);
    if (!exists) break;
    sessionId = null;
  }
  if (!sessionId) {
    return res.status(500).json({ error: 'Cannot generate session ID' });
  }

  try {
    const session = await db.createSession(sessionId);
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const session = await db.getSession(id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id/history', async (req, res) => {
  const { id } = req.params;
  try {
    const session = await db.getSession(id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const messages = await db.getMessages(id);
    res.json({ session, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const session = await db.getSession(id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    await db.deleteSession(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/join/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^\d{6}$/.test(id)) return res.redirect('/receiver.html');
  try {
    const session = await db.getSession(id);
    if (!session) return res.redirect('/receiver.html');
  } catch (err) {
    return res.redirect('/receiver.html');
  }
  res.redirect(`/receiver.html?sessionId=${id}`);
});
app.patch('/api/messages/:id/answered', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.markMessageAnswered(id);
    if (!result.updated) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const server = http.createServer(app);
const io = socket.init(server, db);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

db.init();
