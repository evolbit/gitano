import { core } from "@tauri-apps/api";

export type TauriCommandPayload = Record<string, unknown>;

export async function invokeCommand<Response>(
  command: string,
  payload?: TauriCommandPayload,
): Promise<Response> {
  return core.invoke<Response>(command, payload);
}
