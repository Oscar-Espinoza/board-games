/**
 * `{@attach modal(() => open)}` keeps a native <dialog> in sync with state and
 * returns focus to whatever opened it.
 */
export const modal = (open: () => boolean) => (dialog: HTMLDialogElement) => {
  if (!open()) return;
  const opener = document.activeElement as HTMLElement | null;
  if (!dialog.open) dialog.showModal();
  return () => {
    if (dialog.open) dialog.close();
    opener?.focus?.({ preventScroll: true });
  };
};
