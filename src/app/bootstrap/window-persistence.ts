import { REPO_LAYOUT } from "@/shared/config/layout";
import {
  createLogicalPosition,
  createLogicalSize,
  getAppWindow,
} from "@/shared/platform/tauri/window";
import {
  rehydrateWorkspaceUiStore,
  useWorkspaceUiStore,
} from "@/features/repository-workspace";

export async function applyWindowConstraints() {
  try {
    const currentWindow = getAppWindow();
    const minSize = createLogicalSize(
      REPO_LAYOUT.window.minWidth,
      REPO_LAYOUT.window.minHeight,
    );
    const persistedBounds = useWorkspaceUiStore.getState().window;
    const width = Math.max(persistedBounds.width, REPO_LAYOUT.window.minWidth);
    const height = Math.max(
      persistedBounds.height,
      REPO_LAYOUT.window.minHeight,
    );

    await currentWindow.setMinSize(minSize);
    await currentWindow.setSizeConstraints({
      minWidth: REPO_LAYOUT.window.minWidth,
      minHeight: REPO_LAYOUT.window.minHeight,
    });
    await currentWindow.setSize(createLogicalSize(width, height));

    if (
      persistedBounds.x !== undefined &&
      persistedBounds.y !== undefined
    ) {
      await currentWindow.setPosition(
        createLogicalPosition(persistedBounds.x, persistedBounds.y),
      );
    }
  } catch (error) {
    console.warn("Failed to apply window constraints", error);
  }
}

async function persistCurrentWindowBounds() {
  try {
    const currentWindow = getAppWindow();

    if (await currentWindow.isMaximized()) {
      return;
    }

    const scaleFactor = await currentWindow.scaleFactor();
    const size = (await currentWindow.innerSize()).toLogical(scaleFactor);
    const position = (await currentWindow.outerPosition()).toLogical(scaleFactor);

    useWorkspaceUiStore.getState().setWindowBounds({
      width: size.width,
      height: size.height,
      x: position.x,
      y: position.y,
    });
  } catch (error) {
    console.warn("Failed to persist window bounds", error);
  }
}

async function setupWindowPersistence() {
  const currentWindow = getAppWindow();

  await Promise.all([
    currentWindow.onResized(({ payload }) => {
      if (payload.width > 0 && payload.height > 0) {
        void persistCurrentWindowBounds();
      }
    }),
    currentWindow.onMoved(({ payload }) => {
      if (payload.x !== undefined && payload.y !== undefined) {
        void persistCurrentWindowBounds();
      }
    }),
  ]);

  window.addEventListener("beforeunload", () => {
    void persistCurrentWindowBounds();
  });
}

export async function setupPersistedWindowState() {
  await rehydrateWorkspaceUiStore();
  await applyWindowConstraints();
  await setupWindowPersistence();
}

export function scheduleWindowConstraintReapply() {
  window.requestAnimationFrame(() => {
    void applyWindowConstraints();

    window.setTimeout(() => {
      void applyWindowConstraints();
    }, 150);
  });
}
