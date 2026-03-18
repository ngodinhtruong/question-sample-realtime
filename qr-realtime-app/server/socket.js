const { Server } = require('socket.io');

let io;

function init(server, db) {
  io = new Server(server);

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('submit-question', async (payload) => {
      if (!payload || !payload.sessionId || !payload.name || !payload.question) return;
      try {
        await db.addMessage(payload.sessionId, payload.name, payload.question);
        io.emit('question-submitted', payload);
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
