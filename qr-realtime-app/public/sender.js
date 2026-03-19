const socket = io();

const createBtn = document.getElementById('createSession');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const sessionBlock = document.getElementById('sessionInfoBlock');
const sessionIdEl = document.getElementById('sessionIdDisplay');
const sessionLinkEl = document.getElementById('sessionLinkDisplay');
const qrCanvas = document.getElementById('qrCanvas');
const qrPlaceholder = document.getElementById('qrPlaceholder');
const questionsBody = document.getElementById('questionsBody');
const emptyState = document.getElementById('emptyState');
const qCountEl = document.getElementById('qCount');
const searchInput = document.getElementById('searchSessionInput');
const searchBtn = document.getElementById('searchSessionBtn');
const historyList = document.getElementById('historyList');
const historyDropdownBtn = document.getElementById('historyDropdownBtn');
const historyDropdownList = document.getElementById('historyDropdownList');
const historyDropdownItems = document.getElementById('historyDropdownItems');
const deleteAllBtn = document.getElementById('deleteAllBtn');
const expandQrBtn = document.getElementById('expandQrBtn');
const qrModal = document.getElementById('qrModal');
const qrModalBackdrop = document.getElementById('qrModalBackdrop');
const closeQrModal = document.getElementById('closeQrModal');
const qrCanvasLarge = document.getElementById('qrCanvasLarge');
const qrModalLink = document.getElementById('qrModalLink');
let sessionId = null;
let sessionLink = null;
let questions = [];
let qCounter = 0;
let historyVisible = false;

function setStatus(text) {
  statusText.textContent = text;
}

function setActiveSession(id) {
  sessionId = id;
  sessionLink = `${location.origin}/join/${sessionId}`;
  sessionIdEl.textContent = sessionId;
  sessionLinkEl.textContent = sessionLink;

  sessionBlock.style.display = 'block';
  qrPlaceholder.style.display = 'none';
  qrCanvas.style.display = 'block';
  QRCode.toCanvas(qrCanvas, sessionLink, { width: 220, margin: 1, color: { dark: '#0d0d0d', light: '#ffffff' } });

  statusDot.classList.add('live');
  // setStatus(`Đang hoạt động · ${sessionId}`);
  saveSessionToLocal(sessionId);
}

function renderQuestions() {
  qCountEl.textContent = questions.length;
  document.querySelectorAll('.q-card').forEach((el) => el.remove());

  if (!questions.length) {
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  questions.forEach((q, i) => {
    const card = document.createElement('div');
    card.className = `q-card ${q.answered ? 'answered' : ''}`;
    card.id = `q-${q.id}`;

    card.innerHTML = `
      <span class="q-number">#${String(i + 1).padStart(2, '0')}</span>

      <div class="q-content">
        <div class="q-name">${escapeHtml(q.name || 'Ẩn danh')}</div>
        <div class="q-text">${escapeHtml(q.question || '')}</div>
      </div>

      <div class="q-actions">
        <button class="done-btn ${q.answered ? 'answered' : ''}" ${q.answered ? 'disabled' : ''}>
          ${q.answered ? 'Đã trả lời' : 'Đánh dấu đã trả lời'}
        </button>
      </div>
    `;

    const btn = card.querySelector('.done-btn');
    btn.onclick = async () => {
      if (q.answered) return;
      await markAnswered(q.id);
    };

    questionsBody.appendChild(card);
  });
}
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function saveSessionToLocal(id) {
  const list = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
  if (!list.includes(id)) {
    list.unshift(id);
    localStorage.setItem('sessionHistory', JSON.stringify(list.slice(0, 20)));
  }
  renderHistory();
  renderHistoryDropdown();
}

function removeSessionFromLocal(id) {
  const list = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
  const updated = list.filter((x) => x !== id);
  localStorage.setItem('sessionHistory', JSON.stringify(updated));
  renderHistory();
  renderHistoryDropdown();
}

function clearHistoryLocal() {
  localStorage.setItem('sessionHistory', JSON.stringify([]));
  renderHistory();
  renderHistoryDropdown();
}

function renderHistory() {
  const list = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
  historyList.innerHTML = '';
  const truncated = list.slice(0, 10);
  if (!truncated.length) {
    historyList.innerHTML = '<div style="color:#94a3b8;font-size:.85rem;">Chưa có lịch sử phiên.</div>';
    return;
  }
  truncated.forEach((id) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.textContent = id;
    item.onclick = () => loadSessionHistory(id);
    historyList.appendChild(item);
  });
}

function renderHistoryDropdown() {
  const list = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
  historyDropdownItems.innerHTML = '';
  const truncated = list.slice(0, 10);
  if (!truncated.length) {
    historyDropdownItems.innerHTML = '<div style="color:#94a3b8;font-size:.8rem; padding:0.25rem;">Chưa có phiên nào.</div>';
    return;
  }
  truncated.forEach((id) => {
    const wrap = document.createElement('div');
    wrap.className = 'history-dropdown-item';
    const idLink = document.createElement('button');
    idLink.type = 'button';
    idLink.style.background = 'transparent';
    idLink.style.border = 'none';
    idLink.style.color = '#111827';
    idLink.style.fontSize = '0.78rem';
    idLink.style.fontFamily = 'JetBrains Mono, monospace';
    idLink.style.cursor = 'pointer';
    idLink.textContent = id;
    idLink.onclick = () => {
      window.location.href = `/sender/${id}`;
    };
    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.style.background = '#2563eb';
    loadBtn.style.marginLeft = '0.2rem';
    loadBtn.textContent = 'Mở';
    loadBtn.onclick = () => loadSessionHistory(id);
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '⨯';
    delBtn.title = 'Xóa phiên';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      await deleteSession(id);
    };
    wrap.appendChild(idLink);
    wrap.appendChild(loadBtn);
    wrap.appendChild(delBtn);
    historyDropdownItems.appendChild(wrap);
  });
}

async function loadSessionHistory(id) {
  if (!/^\d{6}$/.test(id)) {
    setStatus('ID phiên phải là 6 chữ số.');
    return false;
  }
  try {
    // First, check if session exists
    const checkRes = await fetch(`/api/sessions/${id}`);
    if (!checkRes.ok) {
      if (checkRes.status === 404) {
        setStatus('Phiên đã hết hạn hoặc không tồn tại. Vui lòng nhập ID khác.');
      } else {
        setStatus('Không thể tải phiên.');
      }
      return false;
    }

    // Session exists, show it immediately
    setActiveSession(id);
    saveSessionToLocal(id);
    window.history.replaceState(null, '', `/sender/${id}`);

    // Then try to load history
    try {
      const historyRes = await fetch(`/api/sessions/${id}/history`);
      if (historyRes.ok) {
        const data = await historyRes.json();
        questions = (data.messages || []).map((m) => ({
  id: m.id,
  name: m.name,
  question: m.question,
  answered: !!m.answered
}));
        qCounter = questions.length;
        renderQuestions();
        // setStatus(`Phiên ${id} sẵn sàng.`);
      } else {
        questions = [];
        qCounter = 0;
        renderQuestions();
        // setStatus(`Phiên ${id} sẵn sàng (không tải được lịch sử).`);
      }
    } catch (historyErr) {
      // console.error('History load error:', historyErr);
      questions = [];
      qCounter = 0;
      renderQuestions();
      // setStatus(`Phiên ${id} sẵn sàng.`);
    }
    return true;
  } catch (err) {
    console.error(err);
    setStatus('Lỗi kiểm tra phiên.');
    return false;
  }
}

async function deleteSession(id) {
  if (!/^\d{6}$/.test(id)) return;
  try {
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setStatus('Không thể xóa phiên.');
      return;
    }
    removeSessionFromLocal(id);
    if (sessionId === id) {
      questions = [];
      qCountEl.textContent = '0';
      emptyState.style.display = 'flex';
      sessionBlock.style.display = 'none';
      qrCanvas.style.display = 'none';
      qrPlaceholder.style.display = 'flex';
      statusDot.classList.remove('live');
      setStatus(`Phiên ${id} đã hết hạn. Tạo phiên mới hoặc chọn ID khác.`);
      sessionId = null;
      sessionLink = null;
    }
    renderQuestions();
  } catch (err) {
    console.error(err);
    setStatus('Lỗi xóa phiên.');
  }
}

async function createSession() {
  try {
    const res = await fetch('/api/sessions', { method: 'POST' });
    if (!res.ok) {
      setStatus('Không tạo được phiên.');
      return;
    }
    const data = await res.json();
    const id = data.sessionId;
    if (!id) {
      setStatus('Không nhận được ID phiên.');
      return;
    }
    window.history.replaceState(null, '', `/sender/${id}`);
    setActiveSession(id);
    questions = [];
    qCounter = 0;
    renderQuestions();
    setStatus(``);
    saveSessionToLocal(id);
    await loadSessionHistory(id);
  } catch (err) {
    console.error(err);
    setStatus('Lỗi từ server.');
  }
}

createBtn.addEventListener('click', createSession);
searchBtn.addEventListener('click', () => {
  const val = searchInput.value.trim();
  if (!/^\d{6}$/.test(val)) {
    setStatus('ID phiên phải là 6 chữ số.');
    return;
  }
  window.location.href = `/sender/${val}`;
});
historyDropdownBtn.addEventListener('click', () => {
  historyVisible = !historyVisible;
  historyDropdownList.style.display = historyVisible ? 'block' : 'none';
  if (historyVisible) {
    renderHistoryDropdown();
  }
});
deleteAllBtn.addEventListener('click', async () => {
  const list = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
  for (const id of list) {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
  }
  clearHistoryLocal();
  if (sessionId) {
    sessionId = null;
    sessionLink = null;
    questions = [];
    qCountEl.textContent = '0';
    emptyState.style.display = 'flex';
    sessionBlock.style.display = 'none';
    qrCanvas.style.display = 'none';
    qrPlaceholder.style.display = 'flex';
    statusDot.classList.remove('live');
    setStatus('Đã xóa tất cả phiên. Vui lòng tạo phiên mới.');
  }
});

window.addEventListener('click', (e) => {
  if (!historyDropdownList.contains(e.target) && e.target !== historyDropdownBtn) {
    historyVisible = false;
    historyDropdownList.style.display = 'none';
  }
});

function copyText(type) {
  if (type === 'id' && sessionId) {
    navigator.clipboard.writeText(sessionId);
    setStatus('Đã sao chép ID.');
  }
  if (type === 'link' && sessionLink) {
    navigator.clipboard.writeText(sessionLink);
    setStatus('Đã sao chép link.');
  }
}

socket.on('question-submitted', (payload) => {
  if (!sessionId || payload.sessionId !== sessionId) return;

  questions.unshift({
    id: payload.id,
    name: payload.name,
    question: payload.question,
    answered: false
  });

  renderQuestions();
});
async function markAnswered(questionId) {
  try {
    const res = await fetch(`/api/messages/${questionId}/answered`, {
      method: 'PATCH'
    });

    if (!res.ok) {
      setStatus('Không thể cập nhật trạng thái câu hỏi.');
      return false;
    }

    const q = questions.find(x => x.id === questionId);
    if (q) q.answered = true;

    renderQuestions();
    setStatus('');
    return true;
  } catch (err) {
    console.error(err);
    setStatus('');
    return false;
  }
}
async function loadFromPath() {
  const path = window.location.pathname;
  const match = path.match(/^\/sender\/(\d{6})$/);
  if (match) {
    const loaded = await loadSessionHistory(match[1]);
    if (loaded) return;
  }

  const historyListLs = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
  if (historyListLs.length > 0) {
    const loaded = await loadSessionHistory(historyListLs[0]);
    if (loaded) return;
  }

  setStatus('');
}
function openQrModal() {
  if (!sessionLink) return;
  qrModal.style.display = 'block';
  qrModalLink.textContent = sessionLink;

  QRCode.toCanvas(qrCanvasLarge, sessionLink, {
    width: 520,
    margin: 2,
    color: { dark: '#0d0d0d', light: '#ffffff' }
  });

  document.body.style.overflow = 'hidden';
}

function closeQrModalFn() {
  qrModal.style.display = 'none';
  document.body.style.overflow = '';
}
if (expandQrBtn) {
  expandQrBtn.addEventListener('click', openQrModal);
}

if (closeQrModal) {
  closeQrModal.addEventListener('click', closeQrModalFn);
}

if (qrModalBackdrop) {
  qrModalBackdrop.addEventListener('click', closeQrModalFn);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && qrModal && qrModal.style.display !== 'none') {
    closeQrModalFn();
  }
});
qrCanvas.addEventListener('click', openQrModal);
qrCanvas.style.cursor = 'zoom-in';
renderHistory();
renderHistoryDropdown();
loadFromPath();
