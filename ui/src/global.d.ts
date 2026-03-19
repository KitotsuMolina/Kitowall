export {};

declare global {
  interface Window {
    kitowallDesktop?: {
      invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}
