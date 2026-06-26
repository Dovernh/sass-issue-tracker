/**
 * Global Vitest setup (registered via angular.json `test.setupFiles`).
 * jsdom doesn't implement matchMedia, which ThemeService reads on init — stub
 * it so components that inject ThemeService can be created in tests.
 */
const noop = (): void => undefined;

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: noop,
      removeEventListener: noop,
      addListener: noop,
      removeListener: noop,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
