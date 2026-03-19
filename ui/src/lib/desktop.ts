type DesktopBridge = {
  invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
};

declare global {
  interface Window {
    kitowallDesktop?: DesktopBridge;
  }
}

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!window.kitowallDesktop) {
    throw new Error('Electron bridge is not available');
  }
  return await window.kitowallDesktop.invoke(command, args) as T;
}

export function convertFileSrc(path: string): string {
  return `kitowall-file://${encodeURI(path)}`;
}
