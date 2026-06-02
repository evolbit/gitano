import { BranchConfirmModals } from "../branch-confirm-modals/branch-confirm-modals";
import { BranchCompareModal } from "../branch-compare-modal/branch-compare-modal";
import { BranchContextMenu } from "../branch-context-menu/branch-context-menu";
import { BranchCreateForm } from "../branch-create-form/branch-create-form";
import { BranchListHeader } from "../branch-list-header/branch-list-header";
import { BranchTree } from "../branch-tree/branch-tree";
import { useBranchListBehavior } from "../../hooks/use-branch-list-behavior";

function BranchListProgressBar() {
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 z-30 h-0.5 overflow-hidden bg-blue-500/10"
      role="progressbar"
      aria-label="Refreshing branches"
    >
      <div
        className="h-full w-1/3 rounded-r bg-blue-400/90"
        style={{ animation: "panel-progress 1.1s ease-in-out infinite" }}
      />
    </div>
  );
}

export function BranchList() {
  const branchList = useBranchListBehavior();

  if (!branchList.repoPath) return null;

  const showInitialLoading = branchList.loading && !branchList.hasLoadedOnce;

  return (
    <>
      <div className="relative flex h-full min-w-0 flex-col overflow-hidden bg-background">
        {branchList.loading ? <BranchListProgressBar /> : null}
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
        {showInitialLoading ? (
          <div className="px-3 py-2 text-sm text-zinc-400">Loading...</div>
        ) : null}
        {branchList.error ? (
          <div className="text-sm text-red-400">{branchList.error}</div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!showInitialLoading &&
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
            branchRefByName={branchList.branchRefByName}
            branchType={branchList.branchType}
            selectedBranch={branchList.selectedBranch}
            selectedRowBranch={branchList.selectedRowBranch}
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
            branchRefByName={branchList.branchRefByName}
            branchType={branchList.branchType}
            creatingWorktree={branchList.creatingWorktree}
            matchingPullRequestByHead={branchList.matchingPullRequestByHead}
            remoteUrl={branchList.remoteUrl}
            onCloseContextMenu={branchList.closeContextMenu}
            onBeginCreateBranch={branchList.beginCreateBranch}
            onCheckoutBranch={(branchName) => {
              void branchList.checkoutBranch(branchName);
            }}
            onRunBranchOperation={(...args) => {
              void branchList.runBranchOperation(...args);
            }}
            onRunRemoteBranchOperation={(...args) => {
              void branchList.runRemoteBranchOperation(...args);
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
            onCopyRemoteBranchUrl={(branchName) => {
              void branchList.copyRemoteBranchUrl(branchName);
            }}
            onCopyRemoteCommitUrl={(branchName, commitSha) => {
              void branchList.copyRemoteCommitUrl(branchName, commitSha);
            }}
            onCompareBranch={branchList.openBranchCompare}
            onOpenPullRequestReview={(pullRequest) => {
              void branchList.openPullRequestReview(pullRequest);
            }}
            onOpenPullRequestUrl={(url) => {
              void branchList.openPullRequestUrl(url);
            }}
            onRequestRenameBranch={branchList.requestRenameBranch}
            onRequestDeleteBranch={branchList.requestDeleteBranch}
            onRequestDeleteRemoteBranch={branchList.requestDeleteRemoteBranch}
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
      {branchList.branchComparison ? (
        <BranchCompareModal
          repoPath={branchList.repoPath}
          initialSourceBranch={branchList.branchComparison.sourceBranch}
          initialTargetBranch={branchList.branchComparison.targetBranch}
          onClose={branchList.closeBranchCompare}
        />
      ) : null}
    </>
  );
}
