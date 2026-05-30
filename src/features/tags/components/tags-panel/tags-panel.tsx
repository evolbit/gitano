import { TagContextMenuView } from "./tag-context-menu";
import { TagCreatePanel } from "./tag-create-panel";
import { TagDeleteDialog } from "./tag-delete-dialog";
import { TagRenameDialog } from "./tag-rename-dialog";
import { TagTree } from "./tag-tree";
import { TagsPanelProgressBar } from "./tags-panel-progress-bar";
import { TagsPanelState } from "./tags-panel-state";
import { TagsPanelToolbar } from "./tags-panel-toolbar";
import { useTagsPanelState } from "../../hooks/use-tags-panel-state";
import type { TagsPanelProps } from "./types";

export function TagsPanel({ repoPath }: TagsPanelProps) {
  const panel = useTagsPanelState(repoPath);

  return (
    <div className="h-full flex flex-col relative min-w-0 overflow-hidden bg-background">
      {panel.loading ? <TagsPanelProgressBar /> : null}
      <TagsPanelToolbar
        search={panel.search}
        presenceFilter={panel.tagPresenceFilter}
        requiresInitialCommit={panel.requiresInitialCommit}
        onSearchChange={panel.setSearch}
        onTogglePresence={panel.toggleTagPresenceFilter}
        onAddTag={panel.openAddPanel}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        {panel.originError ? (
          <div className="border-b border-border px-3 py-2 text-xs text-amber-300">
            Origin tags unavailable. Local tags are shown with unknown remote state.
          </div>
        ) : null}
        {panel.actionError && !panel.renameDialog && !panel.deleteDialog ? (
          <div className="border-b border-border px-3 py-2 text-xs text-red-400">
            {panel.actionError}
          </div>
        ) : null}
        {panel.error && panel.hasLoadedOnce ? (
          <div className="border-b border-border px-3 py-2 text-xs text-red-400">
            {panel.error}
          </div>
        ) : null}
        {panel.showInitialLoading ? (
          <TagsPanelState message="Loading" />
        ) : panel.error && !panel.hasLoadedOnce ? (
          <div className="px-3 py-2 text-sm text-red-400">{panel.error}</div>
        ) : panel.groupedTags.length === 0 ? (
          <TagsPanelState message="No tags found" />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <TagTree
              nodes={panel.groupedTags}
              tagTreeExpanded={panel.tagTreeExpanded}
              selectedTag={panel.selectedTag}
              tagRefByName={panel.tagRefByName}
              isRowActionsVisible={panel.isRowActionsVisible}
              onHoverRow={panel.setHoveredRowKey}
              onToggleGroup={panel.toggleGroup}
              onSelectTag={panel.setSelectedTag}
              onOpenContextMenu={panel.openContextMenu}
            />
          </div>
        )}
      </div>
      <TagCreatePanel
        addPanelOpen={panel.addPanelOpen}
        tagName={panel.tagName}
        tagDescription={panel.tagDescription}
        tagAnnotated={panel.tagAnnotated}
        commitSearch={panel.commitSearch}
        commitOptions={panel.commitOptions}
        selectedCommit={panel.selectedCommit}
        commitDropdownOpen={panel.commitDropdownOpen}
        commitLoading={panel.commitLoading}
        createLoading={panel.createLoading}
        createError={panel.createError}
        requiresInitialCommit={panel.requiresInitialCommit}
        onTagNameChange={panel.setTagName}
        onTagDescriptionChange={panel.setTagDescription}
        onTagAnnotatedChange={panel.setTagAnnotated}
        onCommitSearchChange={panel.setCommitSearch}
        onSelectedCommitChange={panel.setSelectedCommit}
        onCommitDropdownOpenChange={panel.setCommitDropdownOpen}
        onCreateTag={panel.handleCreateTag}
        onClose={panel.closeAddPanel}
      />
      <TagRenameDialog
        renameDialog={panel.renameDialog}
        renameAvailability={panel.renameAvailability}
        renameChecking={panel.renameChecking}
        tagActionLoading={panel.tagActionLoading}
        actionError={panel.actionError}
        onValueChange={panel.updateRenameDialogValue}
        onCancel={panel.closeRenameDialog}
        onConfirm={panel.handleRenameTag}
      />
      <TagDeleteDialog
        deleteDialog={panel.deleteDialog}
        tagActionLoading={panel.tagActionLoading}
        actionError={panel.actionError}
        onDeleteOriginChange={panel.updateDeleteOrigin}
        onCancel={panel.closeDeleteDialog}
        onConfirm={panel.handleDeleteTag}
      />
      <TagContextMenuView
        contextMenu={panel.contextMenu}
        menuPos={panel.menuPos}
        menuRef={panel.menuRef}
        tagRefByName={panel.tagRefByName}
        tagActionLoading={panel.tagActionLoading}
        onClose={panel.closeContextMenu}
        onCopyText={panel.copyText}
        onCopyRemoteLink={panel.copyRemoteLink}
        onPushTag={panel.handlePushTag}
        onOpenRenameDialog={panel.openRenameDialog}
        onOpenDeleteDialog={panel.openDeleteDialog}
      />
    </div>
  );
}
