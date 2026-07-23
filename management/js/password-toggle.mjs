for (const toggle of document.querySelectorAll('[data-password-toggle]')) {
  const input = document.getElementById(toggle.dataset.passwordToggle || '');
  if (!input) continue;

  toggle.addEventListener('click', () => {
    const wasVisible = input.type === 'text';
    input.type = wasVisible ? 'password' : 'text';
    toggle.textContent = wasVisible ? 'Show' : 'Hide';
    toggle.setAttribute('aria-pressed', String(!wasVisible));
    const label = toggle.dataset.passwordLabel || 'password';
    toggle.setAttribute('aria-label', `${wasVisible ? 'Show' : 'Hide'} ${label}`);
    input.focus({ preventScroll: true });
    const end = input.value.length;
    input.setSelectionRange?.(end, end);
  });
}
