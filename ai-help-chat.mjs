import { AI_HELP_ENDPOINT } from './ai-help-config.mjs';
import { AI_HELP_ICON_DATA_URI } from './ai-help-icon.mjs';

const STORAGE_KEY = 'chess-study-ai-endpoint-v1';
const MAX_HISTORY_MESSAGES = 12;
const MAX_CONTEXT_NOTATION_CHARS = 3200;
const REQUEST_TIMEOUT_MS = 45000;

function isEmbeddedBoard() {
  const root = document.documentElement;
  if (root.dataset.embed === '1' || root.dataset.boardOnly === '1') {
    return true;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('embed') === '1'
      || params.get('embed') === 'true'
      || params.get('boardOnly') === '1'
      || params.get('boardOnly') === 'true';
  } catch {
    return false;
  }
}

function normalizeEndpoint(value) {
  const endpoint = String(value || '').trim().replace(/\/+$/, '');
  if (!endpoint || !/^https?:\/\//i.test(endpoint)) {
    return '';
  }
  return endpoint.endsWith('/chat') ? endpoint : `${endpoint}/chat`;
}

function readStoredEndpoint() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function saveStoredEndpoint(value) {
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage may be disabled. The current session still works.
  }
}

function textFrom(selector, maxLength = 500) {
  const element = document.querySelector(selector);
  if (!element) {
    return '';
  }
  const raw = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    ? element.value
    : element.textContent;
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function collectChessContext() {
  const activeTab = document.querySelector('.tab-chip.is-active');
  const notation = document.querySelector('#notationPanel');
  const opening = [
    textFrom('#openingEcoText', 40),
    textFrom('#openingNameText', 180),
  ].filter(Boolean).join(' ');

  return {
    lessonTitle: textFrom('#titleInput', 160) || textFrom('#boardTitleDisplay', 160),
    fen: textFrom('#currentFenCode', 180),
    setupFen: textFrom('#setupFenCode', 180),
    opening,
    activeTab: String(activeTab?.textContent || '').trim().slice(0, 40),
    positionLabel: textFrom('#boardContextLabel', 120),
    sideToMove: textFrom('#turnToken', 80),
    notation: String(notation?.innerText || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_CONTEXT_NOTATION_CHARS),
  };
}

function injectStylesheet() {
  const id = 'aiHelpChatStylesheet';
  if (document.getElementById(id)) {
    return;
  }
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = new URL('./ai-help-chat.css?v=20260718-ai-help3', import.meta.url).href;
  document.head.append(link);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function mountChat() {
  if (isEmbeddedBoard() || document.getElementById('aiHelpChatRoot')) {
    return;
  }

  injectStylesheet();

  let endpoint = normalizeEndpoint(AI_HELP_ENDPOINT) || normalizeEndpoint(readStoredEndpoint());
  let messages = [];
  let isSending = false;

  const root = createElement('div', 'ai-help-chat', undefined);
  root.id = 'aiHelpChatRoot';

  const launcher = createElement('button', 'ai-help-launcher', undefined);
  launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Open AI chess help');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'aiHelpPanel');
  launcher.innerHTML = `
    <img
      src="${AI_HELP_ICON_DATA_URI}"
      alt=""
      aria-hidden="true"
      style="width:2.65rem;height:2.65rem;display:block;flex:0 0 auto;box-sizing:border-box;padding:.12rem;border-radius:.6rem;object-fit:contain;object-position:center;background:#061515;box-shadow:0 0 0 2px rgba(255,255,255,.26);"
    >
    <span>AI Help</span>
  `;

  const panel = createElement('section', 'ai-help-panel', undefined);
  panel.id = 'aiHelpPanel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'AI chess help chat');

  const header = createElement('header', 'ai-help-header', undefined);
  const headingWrap = createElement('div', 'ai-help-heading-wrap', undefined);
  const title = createElement('h2', 'ai-help-title', 'AI Chess Help');
  const subtitle = createElement('p', 'ai-help-subtitle', 'Ask about the current board or lesson.');
  headingWrap.append(title, subtitle);

  const headerActions = createElement('div', 'ai-help-header-actions', undefined);
  const clearButton = createElement('button', 'ai-help-icon-button', 'Clear');
  clearButton.type = 'button';
  clearButton.title = 'Clear conversation';
  const closeButton = createElement('button', 'ai-help-icon-button ai-help-close', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close AI chess help');
  headerActions.append(clearButton, closeButton);
  header.append(headingWrap, headerActions);

  const transcript = createElement('div', 'ai-help-transcript', undefined);
  transcript.setAttribute('role', 'log');
  transcript.setAttribute('aria-live', 'polite');
  transcript.setAttribute('aria-relevant', 'additions');

  const setup = createElement('div', 'ai-help-setup', undefined);
  const setupText = createElement(
    'p',
    'ai-help-setup-copy',
    'The AI proxy is not connected yet. Paste the deployed Worker URL to test it in this browser.',
  );
  const setupRow = createElement('div', 'ai-help-setup-row', undefined);
  const endpointInput = createElement('input', 'ai-help-endpoint-input', undefined);
  endpointInput.type = 'url';
  endpointInput.placeholder = 'https://your-worker.workers.dev';
  endpointInput.autocomplete = 'url';
  endpointInput.spellcheck = false;
  const saveEndpointButton = createElement('button', 'ai-help-save-endpoint', 'Save');
  saveEndpointButton.type = 'button';
  setupRow.append(endpointInput, saveEndpointButton);
  setup.append(setupText, setupRow);

  const suggestions = createElement('div', 'ai-help-suggestions', undefined);
  ['Explain this position', 'What should I look for?', 'Give me a small hint'].forEach((label) => {
    const button = createElement('button', 'ai-help-suggestion', label);
    button.type = 'button';
    button.dataset.prompt = label;
    suggestions.append(button);
  });

  const form = createElement('form', 'ai-help-form', undefined);
  const input = createElement('textarea', 'ai-help-input', undefined);
  input.rows = 2;
  input.maxLength = 2000;
  input.placeholder = 'Ask about the position…';
  input.setAttribute('aria-label', 'Message for AI chess help');
  const sendButton = createElement('button', 'ai-help-send', 'Send');
  sendButton.type = 'submit';
  form.append(input, sendButton);

  const disclaimer = createElement(
    'p',
    'ai-help-disclaimer',
    'AI can make mistakes. Verify concrete tactics with Stockfish.',
  );

  panel.append(header, transcript, setup, suggestions, form, disclaimer);
  root.append(panel, launcher);
  document.body.append(root);

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    root.classList.toggle('is-open', open);
    if (open) {
      window.setTimeout(() => (endpoint ? input : endpointInput).focus(), 0);
    } else {
      launcher.focus();
    }
  }

  function updateConnectionUi() {
    const connected = Boolean(endpoint);
    setup.hidden = connected;
    suggestions.hidden = !connected;
    form.hidden = !connected;
    clearButton.hidden = messages.length === 0;
  }

  function appendMessage(role, content, extraClass = '') {
    const message = createElement('div', `ai-help-message ai-help-message-${role} ${extraClass}`.trim(), undefined);
    const label = createElement('div', 'ai-help-message-label', role === 'user' ? 'You' : 'Dyno Bot');
    const body = createElement('div', 'ai-help-message-body', content);
    message.append(label, body);
    transcript.append(message);
    transcript.scrollTop = transcript.scrollHeight;
    return message;
  }

  function showWelcome() {
    transcript.replaceChildren();
    appendMessage(
      'assistant',
      'I can explain the current position, plans, candidate moves, tactical ideas, and lesson concepts. I receive the visible FEN and notation automatically.',
      'ai-help-message-welcome',
    );
  }

  function setSending(value) {
    isSending = value;
    input.disabled = value;
    sendButton.disabled = value;
    sendButton.textContent = value ? 'Thinking…' : 'Send';
  }

  async function sendMessage(rawText) {
    const text = String(rawText || '').trim();
    if (!text || isSending || !endpoint) {
      return;
    }

    messages.push({ role: 'user', content: text });
    messages = messages.slice(-MAX_HISTORY_MESSAGES);
    appendMessage('user', text);
    input.value = '';
    updateConnectionUi();
    setSending(true);

    const pending = appendMessage('assistant', 'Thinking…', 'is-pending');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          context: collectChessContext(),
        }),
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Request failed (${response.status})`);
      }

      const answer = String(payload.text || '').trim();
      if (!answer) {
        throw new Error('The AI returned an empty response.');
      }

      messages.push({ role: 'model', content: answer });
      messages = messages.slice(-MAX_HISTORY_MESSAGES);
      pending.querySelector('.ai-help-message-body').textContent = answer;
      pending.classList.remove('is-pending');
    } catch (error) {
      const message = error?.name === 'AbortError'
        ? 'The request timed out. Please try again.'
        : `I could not reach the AI service: ${error?.message || 'Unknown error'}`;
      pending.querySelector('.ai-help-message-body').textContent = message;
      pending.classList.remove('is-pending');
      pending.classList.add('is-error');
    } finally {
      window.clearTimeout(timeout);
      setSending(false);
      input.focus();
      transcript.scrollTop = transcript.scrollHeight;
    }
  }

  launcher.addEventListener('click', () => setOpen(panel.hidden));
  closeButton.addEventListener('click', () => setOpen(false));
  clearButton.addEventListener('click', () => {
    messages = [];
    showWelcome();
    updateConnectionUi();
    input.focus();
  });

  saveEndpointButton.addEventListener('click', () => {
    const nextEndpoint = normalizeEndpoint(endpointInput.value);
    if (!nextEndpoint) {
      endpointInput.setCustomValidity('Enter a valid http or https Worker URL.');
      endpointInput.reportValidity();
      return;
    }
    endpointInput.setCustomValidity('');
    endpoint = nextEndpoint;
    saveStoredEndpoint(nextEndpoint.replace(/\/chat$/, ''));
    updateConnectionUi();
    input.focus();
  });

  suggestions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-prompt]');
    if (button) {
      void sendMessage(button.dataset.prompt);
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void sendMessage(input.value);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input.value);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      setOpen(false);
    }
  });

  showWelcome();
  updateConnectionUi();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountChat, { once: true });
} else {
  mountChat();
}
