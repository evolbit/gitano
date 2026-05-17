import { BranchConfirmModals } from "./branch-confirm-modals";
import { BranchCompareModal } from "./branch-compare-modal";
import { BranchContextMenu } from "./branch-context-menu";
import { BranchCreateForm } from "./branch-create-form";
import { BranchListHeader } from "./branch-list-header";
import { BranchTree } from "./branch-tree";
import { useBranchListBehavior } from "./use-branch-list-behavior";

export function BranchList() {
  const branchList = useBranchListBehavior();

  if (!branchList.repoPath) return null;

  return (
    <>
      <div className="relative flex h-full min-w-0 flex-col overflow-hidden bg-background">
        <BranchListHeader
          search={branchList.search}
          type={branchList.type}
          onSearchChange={branchList.setSearch}
          onTypeChange={branchList.setType}
          onCreateBranch={() =>
            branchList.beginCreateBranch(branchList.selectedBranch || "HEAD")
          }
          createDisabled={branchList.requiresInitialCommit}
          createDisabledReason="Create the initial commit before creating branches"
        />
        {branchList.loading ? (
          <div className="text-sm text-zinc-400">Loading...</div>
        ) : null}
        {branchList.error ? (
          <div className="text-sm text-red-400">{branchList.error}</div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!branchList.loading &&
          !branchList.error &&
          branchList.grouped.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {branchList.requiresInitialCommit
                ? "Create the initial commit before branch actions are available"
                : "No branches found"}
            </div>
          ) : null}
          <BranchTree
            nodes={branchList.grouped}
            branchTreeExpanded={branchList.branchTreeExpanded}
            selectedBranch={branchList.selectedBranch}
            selectedRowBranch={branchList.selectedRowBranch}
            type={branchList.type}
            isRowActionsVisible={branchList.isRowActionsVisible}
            onHoverRow={branchList.setHoveredRowKey}
            onToggleGroup={branchList.toggleGroup}
            onSelectBranch={branchList.setSelectedRowBranch}
            onCheckoutBranch={(branchName) => {
              void branchList.checkoutBranch(branchName);
            }}
            onOpenContextMenu={branchList.openContextMenu}
          />
          <BranchContextMenu
            contextMenu={branchList.contextMenu}
            menuPos={branchList.menuPos}
            menuRef={branchList.menuRef}
            selectedBranch={branchList.selectedBranch}
            type={branchList.type}
            creatingWorktree={branchList.creatingWorktree}
            onCloseContextMenu={branchList.closeContextMenu}
            onBeginCreateBranch={branchList.beginCreateBranch}
            onCheckoutBranch={(branchName) => {
              void branchList.checkoutBranch(branchName);
            }}
            onRunBranchOperation={(...args) => {
              void branchList.runBranchOperation(...args);
            }}
            onRunRemoteBranchAction={(...args) => {
              void branchList.runRemoteBranchAction(...args);
            }}
            onCreateRandomWorktreeFromBranch={(branchName) => {
              void branchList.createRandomWorktreeFromBranch(branchName);
            }}
            onCopyText={(...args) => {
              void branchList.copyText(...args);
            }}
            onCopyBranchTipSha={(branchName) => {
              void branchList.copyBranchTipSha(branchName);
            }}
            onCompareBranch={branchList.openBranchCompare}
            onRequestRenameBranch={branchList.requestRenameBranch}
            onRequestDeleteBranch={branchList.requestDeleteBranch}
          />
        </div>
        {branchList.createForm ? (
          <BranchCreateForm
            createForm={branchList.createForm}
            creatingBranch={branchList.creatingBranch}
            createBranchError={branchList.createBranchError}
            onCreateFormChange={branchList.setCreateForm}
            onCreateBranch={() => {
              void branchList.createBranch();
            }}
            onCancel={branchList.cancelCreateBranch}
          />
        ) : null}
      </div>

      <BranchConfirmModals
        renameRequest={branchList.renameRequest}
        renameBranchName={branchList.renameBranchName}
        deleteRequest={branchList.deleteRequest}
        branchActionLoading={branchList.branchActionLoading}
        onRenameNameChange={branchList.setRenameBranchName}
        onCancelRename={branchList.cancelRenameBranch}
        onConfirmRename={() => {
          void branchList.renameBranch();
        }}
        onCancelDelete={branchList.cancelDeleteBranch}
        onConfirmDelete={() => {
          void branchList.deleteBranch();
        }}
      />
      {branchList.compareSourceBranch ? (
        <BranchCompareModal
          repoPath={branchList.repoPath}
          sourceBranch={branchList.compareSourceBranch}
          currentBranch={branchList.selectedBranch}
          onClose={branchList.closeBranchCompare}
        />
      ) : null}
    </>
  );
}
