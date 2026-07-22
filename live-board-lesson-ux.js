(() => {
  const button = document.getElementById('importLessonButton');
  const fileInput = document.getElementById('lessonFileInput');
  const message = document.getElementById('lessonMessage');
  const clearButton = document.getElementById('clearLessonButton');

  if (!button || !fileInput || !message) return;

  const defaultLabel = button.textContent;
  let importing = false;
  let timeoutId = null;

  function finishImport() {
    if (!importing) return;
    importing = false;
    window.clearTimeout(timeoutId);
    button.disabled = false;
    button.textContent = defaultLabel;
    button.removeAttribute('aria-busy');
    fileInput.disabled = false;
    if (clearButton) clearButton.disabled = false;
  }

  button.addEventListener('click', () => {
    if (!fileInput.files?.[0] || importing) return;

    importing = true;
    button.disabled = true;
    button.textContent = 'Loading lesson…';
    button.setAttribute('aria-busy', 'true');
    fileInput.disabled = true;
    if (clearButton) clearButton.disabled = true;
    message.classList.remove('error');
    message.textContent = 'Loading and validating lesson file…';

    timeoutId = window.setTimeout(() => {
      if (!importing) return;
      finishImport();
      message.textContent = 'Lesson loading took too long. Please try again.';
      message.classList.add('error');
    }, 30000);
  });

  const observer = new MutationObserver(() => {
    if (!importing) return;
    const text = message.textContent.trim();
    if (!text || text === 'Loading and validating lesson file…') return;
    finishImport();
  });

  observer.observe(message, {
    childList: true,
    characterData: true,
    subtree: true,
  });
})();
