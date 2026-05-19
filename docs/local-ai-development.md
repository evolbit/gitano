# Local AI Development

Gitano local AI runs repository analysis against a Gitano-managed local Ollama runtime. By default Gitano downloads the runtime into its local AI data directory, starts it on `http://127.0.0.1:11435`, and points `OLLAMA_MODELS` at Gitano-managed model storage.

Set `OLLAMA_HOST` only when developing against an external Ollama service.

## Default Model

The recommended default is `qwen2.5-coder:7b`. The curated registry also includes faster and larger choices:

- `qwen2.5-coder:1.5b`
- `qwen2.5-coder:3b`
- `deepseek-coder:1.3b`
- `qwen2.5-coder:7b`
- `phi4-mini`
- `qwen2.5-coder:14b`
- `qwen2.5-coder:32b`
- `qwen3-coder:30b`

Global and per-action preferences are stored under `~/.gitano/local-ai` unless `GITANO_LOCAL_AI_HOME` is set.

## Model Storage

Gitano stores local AI runtime files, model weights, preferences, and analysis cache in its local AI data directory. By default that is `~/.gitano/local-ai`; in development it can be overridden with `GITANO_LOCAL_AI_HOME`.

The managed Ollama runtime stores models under `<local-ai-data>/models/ollama`. If `OLLAMA_HOST` is set, Gitano treats that runtime as external and model placement is controlled by that external runtime instead.

This keeps the product flow as one app-owned setup step while preserving a later path to replace the managed Ollama runtime with a direct GGUF/llama.cpp runtime.

## Entitlement Stub

The backend currently enables local AI through a development entitlement stub. Set `GITANO_LOCAL_AI_DEV_ENTITLEMENT=0` to simulate a missing premium entitlement.

Production builds still need signed license or receipt verification before this can be treated as a real premium gate.

## Runtime Limits

Gitano installs the managed local AI runtime automatically during model setup when it is missing, then downloads the selected model. The setup surface shows both phases separately: `Downloading runtime...` first, then `Downloading model <model-id>...`. Both phases report percentages when the underlying download provides byte totals.

Model compatibility checks warn or block based on detected memory and free local AI model-storage disk space. Unsupported platforms return a runtime setup error until a packaged runtime is added for that platform.

Analysis results are cached by action, prompt version, model digest, repository identity, and Git input digest. Use force refresh from UI actions to bypass a matching cached result.
