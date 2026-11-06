/** Focus the result actions and keep keyboard navigation inside the dialog. */
export function focusResultOverlay(root: HTMLElement): () => void {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const actions = () => Array.from(root.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
    .filter(button => !button.hidden && button.getClientRects().length > 0);
  const onKeyDown = (event: KeyboardEvent) => {
    // Game shortcuts must not run while choosing a result action.
    event.stopPropagation();
    if (event.key !== 'Tab') return;
    const buttons = actions();
    const first = buttons[0];
    const last = buttons.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  };
  root.addEventListener('keydown', onKeyDown);
  actions()[0]?.focus({ preventScroll: true });
  return () => {
    root.removeEventListener('keydown', onKeyDown);
    if (root.contains(document.activeElement) && previous?.isConnected) previous.focus({ preventScroll: true });
  };
}
