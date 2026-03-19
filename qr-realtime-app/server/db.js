const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');

function openDb() {
  const db = new sqlite3.Database(DB_PATH);
  return db;
}

const { Server } = require('socket.io');

let io;

function init(server, db) {
  io = new Server(server);

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('submit-question', async (payload) => {
      if (!payload || !payload.sessionId || !payload.name || !payload.question) return;

      try {
        const message = await db.addMessage(
          payload.sessionId,
          payload.name,
          payload.question
        );

        io.emit('question-submitted', {
          id: message.id,
          sessionId: message.sessionId,
          name: message.name,
          question: message.question,
          createdAt: message.createdAt,
          answered: !!message.answered
        });
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

module.exports = { init };
function createSession(sessionId) {
  return new Promise((resolve, reject) => {
    const db = openDb();
    const now = Date.now();
    db.run(
      'INSERT INTO sessions (sessionId, createdAt) VALUES (?, ?)',
      [sessionId, now],
      function (err) {
        db.close();
        if (err) return reject(err);
        resolve({ sessionId, createdAt: now });
      }
    );
  });
}

function getSession(sessionId) {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.get('SELECT sessionId, createdAt FROM sessions WHERE sessionId = ?', [sessionId], (err, row) => {
      db.close();
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function addMessage(sessionId, name, question) {
  return new Promise((resolve, reject) => {
    const db = openDb();
    const now = Date.now();
    db.run(
      'INSERT INTO messages (sessionId, name, question, createdAt, answered) VALUES (?, ?, ?, ?, 0)',
      [sessionId, name, question, now],
      function (err) {
        db.close();
        if (err) return reject(err);
        resolve({ id: this.lastID, sessionId, name, question, createdAt: now, answered: 0 });
      }
    );
  });
}

function getMessages(sessionId) {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.all(
        'SELECT id, sessionId, name, question, createdAt, answered FROM messages WHERE sessionId = ? ORDER BY createdAt ASC, id ASC',
      [sessionId],
      (err, rows) => {
        db.close();
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}
function markMessageAnswered(messageId) {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.run(
      'UPDATE messages SET answered = 1 WHERE id = ?',
      [messageId],
      function (err) {
        db.close();
        if (err) return reject(err);
        resolve({ updated: this.changes });
      }
    );
  });
}
function deleteSession(sessionId) {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.serialize(() => {
      db.run('DELETE FROM messages WHERE sessionId = ?', [sessionId], (err) => {
        if (err) {
          db.close();
          return reject(err);
        }
        db.run('DELETE FROM sessions WHERE sessionId = ?', [sessionId], function (err2) {
          db.close();
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