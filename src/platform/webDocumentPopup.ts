/** Call only for the web platform and synchronously inside a user gesture. */
export function reserveDocumentPopup(): Window | null {
  let popup: Window | null = null;
  try {
    popup = window.open('about:blank', '_blank');
    if (popup) {
      popup.opener = null;
      const policy = popup.document.createElement('meta');
      policy.name = 'referrer';
      policy.content = 'no-referrer';
      popup.document.head.appendChild(policy);
    }
    return popup;
  } catch {
    popup?.close();
    return null;
  }
}
