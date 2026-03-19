const socket = io();
const askForm = document.getElementById('askForm');
const nameInput = document.getElementById('name');
const questionInput = document.getElementById('question');
const sessionInput = document.getElementById('sessionInput');
const setSessionBtn = document.getElementById('setSessionBtn');
const sessionBadge = document.getElementById('sessionBadge');
const submitBtn = document.getElementById('submitBtn');
const messageEl = document.getElementById('message');

let currentSessionId = null;

// Hide question form until ID is validated
askForm.style.display = 'none';

function showMessage(text, type = 'success') {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.style.display = 'block';
}

function setSession(sessionId) {
  currentSessionId = sessionId;
  sessionBadge.textContent = `Session ID: ${sessionId}`;
  sessionBadge.style.background = '#eff6ff';
  sessionBadge.style.color = '#1d4ed8';
  submitBtn.disabled = false;
  askForm.style.display = 'block';
  showMessage('Phiên đã bật. Bạn có thể gửi câu hỏi.', 'success');
}

function disableSession(message) {
  currentSessionId = null;
  sessionBadge.textContent = 'Chưa có phiên.';
  submitBtn.disabled = true;
  askForm.style.display = 'none';
  showMessage(message, 'error');
}

async function validateSession(sessionId) {
  try {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) {
      if (res.status === 404) {
        disableSession('Phiên đã hết hạn hoặc không tồn tại. Vui lòng nhập ID khác.');
      } else {
        disableSession('Phiên không tồn tại. Vui lòng kiểm tra ID.');
      }
      return;
    }
    setSession(sessionId);
  } catch (err) {
    console.error(err);
    disableSession('Lỗi kết nối. Thử lại.');
  }
}

setSessionBtn.addEventListener('click', async () => {
  const id = sessionInput.value.trim();

  if (!/^\d{6}$/.test(id)) {
    disableSession('ID phải là 6 chữ số.');
    return;
  }

  try {
    const res = await fetch(`/api/sessions/${id}`);
    if (!res.ok) {
      if (res.status === 404) {
        disableSession('Phiên đã hết hạn hoặc không tồn tại. Vui lòng nhập ID khác.');
      } else {
        disableSession('Phiên không tồn tại. Vui lòng kiểm tra ID.');
      }
      return;
    }

    window.location.href = `/join/${id}`;
  } catch (err) {
    console.error(err);
    disableSession('Lỗi kết nối. Thử lại.');
  }
});

// If link has sessionId param, try using it.
const urlParams = new URLSearchParams(window.location.search);
const initialSessionId = urlParams.get('sessionId');
if (initialSessionId && /^\d{6}$/.test(initialSessionId)) {
  sessionInput.value = initialSessionId;
  validateSession(initialSessionId);
} else {
  disableSession('Vui lòng nhập ID phiên để tiếp tục.');
}

askForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentSessionId) {
    showMessage('Vui lòng thiết lập ID phiên trước khi gửi câu hỏi.', 'error');
    return;
  }

  const name = nameInput.value.trim();
  const question = questionInput.value.trim();
  if (!name || !question) {
    showMessage('Vui lòng điền đầy đủ tên và câu hỏi.', 'error');
    return;
  }

  socket.emit('submit-question', { sessionId: currentSessionId, name, question });
  showMessage('Câu hỏi đã được gửi thành công!', 'success');
  questionInput.value = '';
});
