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

## Tecnologías

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Tauri (Rust)
- **UI Components**: Mantine
- **State Management**: Zustand
- **Git Operations**: libgit2 (Rust)

## Estructura del Proyecto

```
src/
├── components/          # React components
├── hooks/              # Custom hooks
├── store/              # Global state (Zustand)
├── types/              # TypeScript types
└── utils/              # Utilities
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
