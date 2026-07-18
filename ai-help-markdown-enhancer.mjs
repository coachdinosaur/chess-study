const STYLE_ID = 'aiHelpMarkdownEnhancerStyles';
const MESSAGE_SELECTOR = '.ai-help-message-assistant:not(.is-pending):not(.is-error) .ai-help-message-body:not([data-markdown-rendered])';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .ai-help-message-body[data-markdown-rendered="true"] {
      white-space: normal;
    }
    .ai-help-message-body[data-markdown-rendered="true"] p,
    .ai-help-message-body[data-markdown-rendered="true"] ul,
    .ai-help-message-body[data-markdown-rendered="true"] ol,
    .ai-help-message-body[data-markdown-rendered="true"] h3,
    .ai-help-message-body[data-markdown-rendered="true"] h4 {
      margin: 0 0 0.65rem;
    }
    .ai-help-message-body[data-markdown-rendered="true"] > :last-child {
      margin-bottom: 0;
    }
    .ai-help-message-body[data-markdown-rendered="true"] ul,
    .ai-help-message-body[data-markdown-rendered="true"] ol {
      padding-left: 1.25rem;
    }
    .ai-help-message-body[data-markdown-rendered="true"] li + li {
      margin-top: 0.28rem;
    }
    .ai-help-message-body[data-markdown-rendered="true"] h3,
    .ai-help-message-body[data-markdown-rendered="true"] h4 {
      font: 750 0.92rem/1.35 var(--font-display, system-ui, sans-serif);
    }
    .ai-help-message-body[data-markdown-rendered="true"] code {
      padding: 0.08rem 0.28rem;
      border-radius: 0.3rem;
      background: var(--accent-soft, rgba(29, 111, 120, 0.11));
      font-size: 0.9em;
    }
  `;
  document.head.append(style);
}

function appendInlineMarkdown(container, source) {
  const text = String(source || '');
  const pattern = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;
  let cursor = 0;

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      container.append(document.createTextNode(text.slice(cursor, index)));
    }

    const token = match[0];
    let element;
    if (token.startsWith('**')) {
      element = document.createElement('strong');
      element.textContent = token.slice(2, -2);
    } else if (token.startsWith('`')) {
      element = document.createElement('code');
      element.textContent = token.slice(1, -1);
    } else {
      element = document.createElement('em');
      element.textContent = token.slice(1, -1);
    }
    container.append(element);
    cursor = index + token.length;
  }

  if (cursor < text.length) {
    container.append(document.createTextNode(text.slice(cursor)));
  }
}

function lineStartsBlock(line) {
  return /^#{1,4}\s+/.test(line)
    || /^[-*]\s+/.test(line)
    || /^\d+[.)]\s+/.test(line);
}

function renderSafeMarkdown(target, source) {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
  const fragment = document.createDocumentFragment();
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const heading = document.createElement(headingMatch[1].length <= 2 ? 'h3' : 'h4');
      appendInlineMarkdown(heading, headingMatch[2]);
      fragment.append(heading);
      index += 1;
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      const list = document.createElement('ul');
      while (index < lines.length) {
        const itemMatch = lines[index].trim().match(/^[-*]\s+(.+)$/);
        if (!itemMatch) {
          break;
        }
        const item = document.createElement('li');
        appendInlineMarkdown(item, itemMatch[1]);
        list.append(item);
        index += 1;
      }
      fragment.append(list);
      continue;
    }

    const orderedMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      const list = document.createElement('ol');
      while (index < lines.length) {
        const itemMatch = lines[index].trim().match(/^\d+[.)]\s+(.+)$/);
        if (!itemMatch) {
          break;
        }
        const item = document.createElement('li');
        appendInlineMarkdown(item, itemMatch[1]);
        list.append(item);
        index += 1;
      }
      fragment.append(list);
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || lineStartsBlock(next)) {
        break;
      }
      paragraphLines.push(next);
      index += 1;
    }
    const paragraph = document.createElement('p');
    appendInlineMarkdown(paragraph, paragraphLines.join(' '));
    fragment.append(paragraph);
  }

  target.replaceChildren(fragment);
  target.dataset.markdownRendered = 'true';
}

function renderPendingMessages() {
  document.querySelectorAll(MESSAGE_SELECTOR).forEach((body) => {
    renderSafeMarkdown(body, body.textContent);
  });
}

function initialize() {
  injectStyles();
  renderPendingMessages();

  const observer = new MutationObserver(() => renderPendingMessages());
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class'],
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}
