import { useEffect, useRef, type RefObject } from 'react';

const modalStack: HTMLElement[] = [];
const inertLocks = new Map<HTMLElement, { count: number; previous: boolean }>();
let bodyLocks = 0;
let previousOverflow = '';

const focusableSelector =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Adds focus/keyboard semantics to existing dialog markup without changing its appearance. */
export function useModalFocus(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const isolated: HTMLElement[] = [];
    for (
      let branch: HTMLElement | null = dialog;
      branch?.parentElement;
      branch = branch.parentElement
    ) {
      for (const sibling of branch.parentElement.children) {
        if (!(sibling instanceof HTMLElement) || sibling === branch) continue;
        const lock = inertLocks.get(sibling) ?? { count: 0, previous: sibling.inert };
        lock.count++;
        inertLocks.set(sibling, lock);
        sibling.inert = true;
        isolated.push(sibling);
      }
      if (branch.parentElement === document.body) break;
    }
    if (bodyLocks++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    modalStack.push(dialog);
    const focusables = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => !element.closest('[inert]') && element.getClientRects().length > 0,
      );
    const focusFirst = () => (focusables()[0] ?? dialog).focus({ preventScroll: true });
    focusFirst();
    const onKeyDown = (event: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const controls = focusables();
        const first = controls[0] ?? dialog;
        const last = controls[controls.length - 1] ?? dialog;
        if (!controls.length || !dialog.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (modalStack[modalStack.length - 1] === dialog && !dialog.contains(event.target as Node))
        focusFirst();
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocus);
      const index = modalStack.indexOf(dialog);
      if (index >= 0) modalStack.splice(index, 1);
      for (const element of isolated) {
        const lock = inertLocks.get(element);
        if (lock && --lock.count === 0) {
          element.inert = lock.previous;
          inertLocks.delete(element);
        }
      }
      if (--bodyLocks === 0) document.body.style.overflow = previousOverflow;
      if (opener?.isConnected && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
    };
  }, [open, dialogRef]);
}
