import { listen } from "@tauri-apps/api/event";

export type TauriEvent<TPayload> = {
  payload: TPayload;
};

export function listenToEvent<TPayload>(
  eventName: string,
  handler: (event: TauriEvent<TPayload>) => void,
) {
  return listen<TPayload>(eventName, handler);
}
