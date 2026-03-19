const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');

// ✅ chỉ mở 1 connection duy nhất
const db = new sqlite3.Database(DB_PATH);

// 👉 bật WAL mode (quan trọng)
db.run("PRAGMA journal_mode = WAL;");
db.run("PRAGMA synchronous = NORMAL;");

// retry helper
function runWithRetry(sql, params = [], retries = 5) {
  return new Promise((resolve, reject) => {
    function attempt() {
      db.run(sql, params, function (err) {
        if (err && err.code === 'SQLITE_BUSY' && retries > 0) {
          retries--;
          return setTimeout(attempt, 50);
        }
        if (err) return reject(err);
        resolve(this);
      });
    }
    attempt();
  });
}

const { Server } = require('socket.io');

let io;

function init(server) {
  io = new Server(server);

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('submit-question', async (payload) => {
      if (!payload || !payload.sessionId || !payload.name || !payload.question) return;

      try {
        const message = await addMessage(
          payload.sessionId,
          payload.name,
          payload.question
        );

        io.emit('question-submitted', message);
      } catch (err) {
        console.error('DB error addMessage', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

// ---------------- DB FUNCTIONS ----------------

function createSession(sessionId) {
  const now = Date.now();
  return runWithRetry(
    'INSERT INTO sessions (sessionId, createdAt) VALUES (?, ?)',
    [sessionId, now]
  ).then(() => ({ sessionId, createdAt: now }));
}

function getSession(sessionId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT sessionId, createdAt FROM sessions WHERE sessionId = ?',
      [sessionId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });
}

function addMessage(sessionId, name, question) {
  const now = Date.now();

  return runWithRetry(
    'INSERT INTO messages (sessionId, name, question, createdAt, answered) VALUES (?, ?, ?, ?, 0)',
    [sessionId, name, question, now]
  ).then((result) => ({
    id: result.lastID,
    sessionId,
    name,
    question,
    createdAt: now,
    answered: 0
  }));
}

function getMessages(sessionId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT id, sessionId, name, question, createdAt, answered FROM messages WHERE sessionId = ? ORDER BY createdAt ASC, id ASC',
      [sessionId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

function markMessageAnswered(messageId) {
  return runWithRetry(
    'UPDATE messages SET answered = 1 WHERE id = ?',
    [messageId]
  ).then((res) => ({ updated: res.changes }));
}

function deleteSession(sessionId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM messages WHERE sessionId = ?', [sessionId], (err) => {
        if (err) return reject(err);

        db.run('DELETE FROM sessions WHERE sessionId = ?', [sessionId], function (err2) {
          if (err2) return reject(err2);
          resolve({ deleted: this.changes });
        });
      });
    });
  });
}

module.exports = {
  init,
  createSession,
  getSession,
  addMessage,
  getMessages,
  deleteSession,
  markMessageAnswered
};