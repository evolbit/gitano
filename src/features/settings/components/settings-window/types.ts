export type SettingsPane =
  | "runtime"
  | "models"
  | "externalAgents"
  | "configuration";

export type SettingsWindowProps = {
  open: boolean;
  onClose: () => void;
  repoPath?: string | null;
};

export type WarmConfirmation = {
  modelId: string;
  title: string;
  description: string;
  details: string;
};
