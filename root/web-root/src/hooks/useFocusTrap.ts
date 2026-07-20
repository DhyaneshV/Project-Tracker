import { useEffect, useRef } from 'react';

/**
 * useFocusTrap - Traps keyboard focus within a container.
 * Tab cycles through focusable elements. Escape calls onClose.
 * Focus moves to the first element on mount, returns to trigger on unmount.
 */
export function useFocusTrap(active: boolean, onClose?: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Store the element that triggered the modal
    triggerRef.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // Focus first focusable element
    const focusables = container.querySelectorAll<HTMLElement>(
      'input, button, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length > 0) {
      setTimeout(() => focusables[0].focus(), 50);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableEls = container.querySelectorAll<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusableEls.length === 0) return;

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Return focus to trigger element
      if (triggerRef.current && triggerRef.current.focus) {
        triggerRef.current.focus();
      }
    };
  }, [active, onClose]);

  return containerRef;
}
