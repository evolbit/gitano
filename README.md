# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and
Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) +
  [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) +
  [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

# Gitano

Una aplicación de escritorio moderna para gestionar repositorios Git, construida
con Tauri y React.

## Características

### Detección Automática de Cambios

Gitano incluye un sistema avanzado de detección automática de cambios en el
working directory de cada repositorio:

#### Funcionalidades del Sistema de Detección

- **Polling Automático**: Cada pestaña de repositorio detecta cambios
  automáticamente cada 3 segundos
- **Cache Inteligente**: Los cambios se cachean por repositorio para evitar
  llamadas duplicadas
- **Pausado Inteligente**: El polling se pausa automáticamente cuando la pestaña
  no está activa
- **Notificaciones**: Alertas visuales y notificaciones del sistema cuando se
  detectan nuevos cambios
- **Indicadores Visuales**: El acordeón de cambios muestra indicadores cuando
  hay cambios nuevos

#### Controles Disponibles

En cada pestaña de repositorio, en el panel de "Changes":

- **Indicador de Estado**: Muestra si el polling está activo (verde) o pausado
  (naranja)
- **Botón Pausar/Reanudar**: Control manual del polling automático
- **Botón Refrescar**: Actualización manual inmediata de los cambios
- **Botón de Notificaciones**: Solicitar permisos para notificaciones del
  sistema
- **Timestamp**: Muestra la última actualización de los cambios

#### Configuración del Polling

El sistema de detección se puede configurar con las siguientes opciones:

```typescript
useWorkingDirectoryChanges(repoPath, {
  pollInterval: 3000, // Polling interval in milliseconds (default: 2000)
  enabled: true, // Enable or disable polling
  pauseOnInactive: true, // Pause when the tab is not active
  showNotifications: true, // Show system notifications
  cacheKey: "unique-key", // Unique key for caching results
});
```

#### Notificaciones

- **Notificaciones del Sistema**: Se muestran cuando se detectan nuevos cambios
  (requiere permisos)
- **Indicadores Visuales**: El acordeón muestra un punto rojo y etiqueta "Nuevo"
  cuando hay cambios
- **Auto-limpieza**: Los indicadores se limpian automáticamente al abrir el
  panel de cambios

#### Optimizaciones

- **Cache por Repositorio**: Evita múltiples llamadas al mismo repositorio
- **Detección de Cambios Reales**: Solo actualiza la UI cuando hay cambios
  reales
- **Pausado por Visibilidad**: Reduce el uso de recursos cuando la aplicación no
  está visible
- **Cleanup Automático**: Limpia recursos cuando se cierran pestañas

## Instalación

```bash
# Clone the repository
git clone <repository-url>
cd gitano

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

### GitHub OAuth local development

GitHub pull request integration uses OAuth device authorization. Create a
GitHub OAuth app, enable Device Flow, and provide its public client id before
starting Gitano:

```bash
cp .env.example .env.local
# Edit .env.local and set GITANO_GITHUB_OAUTH_CLIENT_ID
pnpm tauri dev
```

The client id is not a user token or secret. Gitano stores the resulting OAuth
access token in backend-owned secure storage after the user authorizes Gitano.

### Verificacion del bundle macOS

Las builds de macOS deben validar que el ejecutable empaquetado no dependa de
librerias nativas instaladas con Homebrew, MacPorts u otro gestor local. Para
generar solo el `.app` y revisar sus dependencias dinamicas:

```bash
pnpm tauri build --bundles app
pnpm verify:macos-bundle-deps
```

El comando de verificacion usa `otool -L` sobre
`src-tauri/target/release/bundle/macos/gitano.app/Contents/MacOS/gitano`.
Tambien acepta una ruta explicita al ejecutable si se quiere revisar otro
bundle:

```bash
scripts/verify-macos-bundle-deps.sh /path/to/gitano.app/Contents/MacOS/gitano
```

## Tecnologías

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Tauri (Rust)
- **UI Components**: Mantine
- **State Management**: Zustand
- **Git Operations**: libgit2 (Rust)

## Estructura del Proyecto

```
src/
├── app/                # Bootstrap, providers, shell composition, app hooks
├── features/           # Feature-first Git workflows
│   ├── branches/       # Branch UI, behavior, API boundary, tests
│   ├── diffs/          # Diff viewer UI and diff-local state
│   ├── history/        # Commit list and commit changes panel
│   ├── launchpad/      # Repository opening and recent/favorite repos UI
│   ├── repository-workspace/
│   │   ├── components/ # Repository layout and tab bar
│   │   └── stores/     # Persisted repo tabs, workspace UI, Git action notices
│   ├── stashes/        # Stash panel and stash file helpers
│   ├── tags/           # Tag panel and tag URL helpers
│   ├── working-changes/# Changes explorer, commit bars, staging hooks/store
│   └── worktrees/      # Worktree panel and worktree helper logic
├── shared/
│   ├── api/            # Typed frontend adapters for Tauri Git commands
│   ├── config/         # App event names and layout constants
│   ├── lib/            # Feature-independent pure utilities
│   ├── platform/       # Tauri dialog/event/storage/window wrappers
│   ├── types/          # Cross-feature Git DTOs and domain types
│   └── ui/             # Generic UI helpers
├── components/         # Reusable generic UI still shared by multiple features
└── test/               # Vitest setup
```

### Reglas de Arquitectura

- `app` compone la aplicacion y puede importar features.
- `features/<feature>` contiene sus componentes, hooks, stores, tipos, utilidades y tests.
- `shared` no debe importar desde `features` ni desde `app`.
- El codigo nuevo debe usar aliases (`@/app`, `@/features`, `@/shared`) para imports entre capas.
- Las llamadas Tauri/Git desde frontend deben pasar por `src/shared/api` o `src/shared/platform`.

### Tests Frontend

```bash
pnpm test
npm run build
```

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más
detalles.
