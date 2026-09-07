export function getPageScrollTarget(): HTMLElement | Window {
  return window.matchMedia('(min-width: 1024px)').matches
    ? (document.querySelector<HTMLElement>('.app-content') ?? window)
    : window;
}
