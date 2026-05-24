import type { ReactNode } from "react";
import type {
  ExternalAiAgentEntry,
  ExternalAiAgentSessionConfig,
  LocalAiActionKind,
  LocalAiModelEntry,
  LocalAiPreferences,
} from "@/shared/api/local-ai";
import {
  ACTIONS,
  INHERIT_EXTERNAL_CONFIG_VALUE,
} from "./config";
import {
  externalAgentActionOptionValues,
  externalAgentEffectiveOptionValue,
  externalAgentGlobalOptionValues,
  externalAgentOptionLabel,
  selectableExternalConfigOptions,
} from "./utils";

export type MaybePromise = void | Promise<void>;

export type EnginePreferenceHandler = (
  value: string,
  actionKind?: LocalAiActionKind | null,
) => MaybePromise;

export type ExternalConfigPreferenceHandler = (
  agentId: string,
  actionKind: LocalAiActionKind | null,
  configId: string,
  value: string | null,
) => MaybePromise;

export function SettingsRow({
  title,
  description,
  children,
  warning,
}: {
  title: string;
  description: string;
  children: ReactNode;
  warning?: string | null;
}) {
  return (
    <div className="border-t border-border py-4">
      <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-5 text-foreground">
            {title}
          </div>
          <div className="mt-1 max-w-[560px] text-xs leading-5 text-zinc-400">
            {description}
          </div>
          {warning ? (
            <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
              {warning}
            </div>
          ) : null}
        </div>
        <div className="flex min-w-0 justify-start md:justify-end">
          {children}
        </div>
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 mt-6 text-xs font-semibold uppercase tracking-normal text-zinc-500">
      {children}
    </div>
  );
}

export function SelectControl({
  value,
  disabled,
  onChange,
  children,
  label,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      className="h-8 w-full min-w-0 rounded border border-border bg-background px-2 text-xs font-medium text-foreground outline-none transition-colors focus:border-blue-500/60 disabled:cursor-not-allowed disabled:opacity-50 md:w-[220px]"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      {children}
    </select>
  );
}

export function EngineOptionGroups({
  catalog,
  externalAgents,
}: {
  catalog: LocalAiModelEntry[];
  externalAgents: ExternalAiAgentEntry[];
}) {
  return (
    <>
      <optgroup label="Local models">
        {catalog.map((model) => (
          <option key={model.id} value={`local:${model.id}`}>
            {model.displayName}
          </option>
        ))}
      </optgroup>
      <optgroup label="External agents">
        {externalAgents.map((agent) => (
          <option
            key={agent.id}
            value={`external:${agent.id}`}
            disabled={!agent.status.available}
          >
            {agent.displayName}
          </option>
        ))}
      </optgroup>
    </>
  );
}

export function ActionButton({
  children,
  onClick,
  disabled,
  variant = "default",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-8 items-center gap-1.5 rounded border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === "danger"
          ? "border-red-500/40 bg-background text-red-100 hover:bg-red-500/10"
          : "border-border bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function ValuePill({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 rounded border border-border bg-background-emphasis px-3 py-1.5 text-right text-xs font-semibold text-zinc-200">
      <span className="block truncate">{children}</span>
    </div>
  );
}

export function WarmModelCheckbox({
  checked,
  disabled,
  reason,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  reason?: string | null;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <label
        className={`flex min-h-5 items-center gap-2 text-xs text-zinc-300 ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
      >
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-blue-500"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <span>Keep this model warm</span>
      </label>
      {disabled && reason ? (
        <div className="max-w-[220px] text-right text-[11px] leading-4 text-zinc-500">
          {reason}
        </div>
      ) : null}
    </div>
  );
}

export function ExternalAgentConfigControls({
  agentId,
  scopeLabel,
  actionKind,
  preferences,
  config,
  loading,
  error,
  onChange,
}: {
  agentId: string;
  scopeLabel: string;
  actionKind: LocalAiActionKind | null;
  preferences: LocalAiPreferences | null;
  config: ExternalAiAgentSessionConfig | null | undefined;
  loading?: boolean;
  error?: string | null;
  onChange: ExternalConfigPreferenceHandler;
}) {
  if (loading && !config) {
    return (
      <div className="w-full text-right text-[11px] leading-4 text-zinc-500">
        Loading agent options...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-right text-[11px] leading-4 text-amber-100">
        {error}
      </div>
    );
  }

  const options = selectableExternalConfigOptions(config);
  if (options.length === 0) {
    return config ? (
      <div className="w-full text-right text-[11px] leading-4 text-zinc-500">
        No configurable agent options.
      </div>
    ) : null;
  }

  const globalValues = externalAgentGlobalOptionValues(preferences, agentId);
  const actionValues = actionKind
    ? externalAgentActionOptionValues(preferences, actionKind, agentId)
    : {};

  return (
    <div className="w-full space-y-2 rounded border border-border bg-background-emphasis p-2">
      {options.map((option) => {
        const optionHasValue = (value: string | undefined) =>
          Boolean(value && option.options.some((item) => item.value === value));
        const fallbackValue = optionHasValue(option.currentValue)
          ? option.currentValue
          : option.options[0]?.value ?? "";
        const effectiveValue = optionHasValue(
          externalAgentEffectiveOptionValue(
            preferences,
            agentId,
            actionKind,
            option,
          ),
        )
          ? externalAgentEffectiveOptionValue(
              preferences,
              agentId,
              actionKind,
              option,
            )
          : fallbackValue;
        const hasActionOverride =
          actionKind !== null &&
          Object.prototype.hasOwnProperty.call(actionValues, option.id);
        const savedGlobalValue = optionHasValue(globalValues[option.id])
          ? globalValues[option.id]
          : fallbackValue;
        const savedActionValue = optionHasValue(actionValues[option.id])
          ? actionValues[option.id]
          : fallbackValue;
        const selectedValue = actionKind
          ? hasActionOverride
            ? savedActionValue
            : INHERIT_EXTERNAL_CONFIG_VALUE
          : savedGlobalValue;

        return (
          <label
            key={option.id}
            className="block text-left text-[11px] font-semibold uppercase tracking-normal text-zinc-500"
          >
            <span>{option.name}</span>
            <select
              aria-label={`${scopeLabel} ${option.name}`}
              className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-xs font-medium normal-case text-foreground outline-none transition-colors focus:border-blue-500/60"
              value={selectedValue}
              onChange={(event) => {
                const value = event.currentTarget.value;
                void onChange(
                  agentId,
                  actionKind,
                  option.id,
                  value === INHERIT_EXTERNAL_CONFIG_VALUE ? null : value,
                );
              }}
            >
              {actionKind ? (
                <option value={INHERIT_EXTERNAL_CONFIG_VALUE}>
                  {`Use global/default (${externalAgentOptionLabel(
                    option,
                    effectiveValue,
                  )})`}
                </option>
              ) : null}
              {option.options.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.name}
                </option>
              ))}
            </select>
            {option.description ? (
              <span className="mt-1 block normal-case leading-4 text-zinc-500">
                {option.description}
              </span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

export function PromptOverrideRow({
  action,
  value,
  hasOverride,
  canSave,
  canUseDefault,
  onChange,
  onSave,
  onUseDefault,
}: {
  action: (typeof ACTIONS)[number];
  value: string;
  hasOverride: boolean;
  canSave: boolean;
  canUseDefault: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onUseDefault: () => void;
}) {
  return (
    <div className="border-t border-border py-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-5 text-foreground">
            {action.label}
          </div>
          <div className="mt-1 max-w-[640px] text-xs leading-5 text-zinc-400">
            {action.description}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <ActionButton disabled={!canUseDefault} onClick={onUseDefault}>
            Use default value
          </ActionButton>
          <ActionButton disabled={!canSave} onClick={onSave}>
            Save
          </ActionButton>
        </div>
      </div>
      <textarea
        aria-label={`${action.label} prompt override`}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="min-h-28 w-full resize-y rounded border border-border bg-background px-3 py-2 font-mono text-xs leading-5 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500/60"
      />
      <div className="mt-2 text-[11px] leading-4 text-zinc-500">
        {hasOverride
          ? "Custom prompt override is active for this action."
          : "Using Gitano's default prompt for this action."}
      </div>
    </div>
  );
}

