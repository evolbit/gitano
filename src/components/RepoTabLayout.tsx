import { Split } from "@gfazioli/mantine-split-pane";
import { Accordion, Box } from "@mantine/core";
import React, { useState } from "react";
import { useWorkingDirectoryChanges } from "../hooks/useWorkingDirectoryChanges";
import { useRepoStore } from "../store/repo";
import { FileChange } from "../types/git";
import { BranchList } from "./BranchList";
import ChangesPanel from "./ChangesPanel";
import CommitList from "./CommitList";
import DiffFileList from "./DiffFileList";
import DiffModal from "./DiffModal";
import { IconFolder, IconGitBranch, IconStack2 } from "./icons";
import TopToolbar from "./TopToolbar";

const RepoTabLayout: React.FC = () => {
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const tab = useRepoStore((s) => s.tabs.find((t) => t.id === activeTabId));
  const repoPath = tab?.repoPath;

  // Hook para obtener los archivos modificados del working directory
  const { changes, loading, error } = useWorkingDirectoryChanges(repoPath);

  // Estado para el modal de diff
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffModalFile, setDiffModalFile] = useState<FileChange | null>(null);

  // Handler para abrir el modal de diff
  const handleOpenDiffModal = (file: FileChange) => {
    setDiffModalFile(file);
    setDiffModalOpen(true);
  };

  if (!tab) return null;

  return (
    <div className="flex h-full w-full flex-col">
      <TopToolbar />
      <div className="flex-1 min-h-0">
        <Split className="h-full w-full min-h-0 flex-1">
          {/* Sidebar izquierdo */}
          <Split.Pane
            initialWidth={240}
            minWidth={300}
            maxWidth={350}
            className="!h-full !min-h-0 flex flex-col">
            <Box className="flex-1 text-foreground flex flex-col min-h-0">
              <Accordion
                defaultValue="changes"
                variant="contained"
                chevronPosition="left"
                classNames={{
                  root: "bg-background-emphasis text-foreground flex-1 flex flex-col min-h-0",
                  item: "group bg-background text-foreground flex flex-col data-[active]:flex-1 data-[active]:min-h-0",
                  control:
                    "bg-background-emphasis text-foreground p-2 transition-colors hover:bg-background-emphasis",
                  panel:
                    "text-foreground flex-1 flex flex-col min-h-0 bg-background-emphasis",
                  content: "flex-1 min-h-0",
                  icon: "mr-2",
                }}>
                <Accordion.Item value="changes">
                  <Accordion.Control>
                    <div className="flex flex-row items-center w-full justify-between">
                      <span className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5">
                          <IconStack2 size={18} />
                        </span>
                        Changes ({changes.length})
                      </span>
                    </div>
                  </Accordion.Control>
                  <Accordion.Panel className="min-w-0">
                    {loading && (
                      <div className="p-4 text-center text-muted-foreground">
                        Cargando cambios...
                      </div>
                    )}
                    {error && (
                      <div className="p-4 text-center text-red-500">
                        Error: {error}
                      </div>
                    )}
                    {!loading && !error && changes.length === 0 && (
                      <div className="p-4 text-center text-muted-foreground">
                        No hay cambios en el working directory
                      </div>
                    )}
                    {!loading && !error && changes.length > 0 && (
                      <DiffFileList
                        files={changes}
                        selectedIndex={0}
                        showSearch={true}
                        onSelect={(file) => {
                          // Solo selección, no acción
                        }}
                        onAction={(file) => handleOpenDiffModal(file)}
                        rowBgColor="bg-background"
                        rowTextColor="text-foreground"
                        highlightSelected={true}
                        rowDividerColor="divide-border"
                        rowPadding="px-2 py-1"
                      />
                    )}
                  </Accordion.Panel>
                </Accordion.Item>
                <Accordion.Item value="branches">
                  <Accordion.Control>
                    <div className="flex flex-row items-center w-full justify-between">
                      <span className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5">
                          <IconGitBranch size={18} />
                        </span>
                        Ramas
                      </span>
                    </div>
                  </Accordion.Control>
                  <Accordion.Panel className="min-w-0">
                    <BranchList />
                  </Accordion.Panel>
                </Accordion.Item>
                <Accordion.Item value="folders">
                  <Accordion.Control>
                    <div className="flex flex-row items-center w-full justify-between">
                      <span className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5">
                          <IconFolder size={18} />
                        </span>
                        Carpetas
                      </span>
                    </div>
                  </Accordion.Control>
                  <Accordion.Panel>
                    {/* Aquí va la lista de carpetas */}
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Box>
          </Split.Pane>
          <Split.Resizer className="!bg-background-emphasis hover:!bg-foreground [--split-resizer-size:1px] m-0 border-r border-border rounded-none" />
          <Split.Pane
            grow
            className="!h-full !min-h-0">
            <Split
              orientation="vertical"
              className="h-full w-full">
              <Split.Pane initialWidth="60%">
                <CommitList />
              </Split.Pane>
              <Split.Resizer className="!bg-border hover:!bg-primary [--split-resizer-size:1px]" />
              <Split.Pane grow>
                <ChangesPanel />
              </Split.Pane>
            </Split>
          </Split.Pane>
        </Split>
      </div>

      {/* Modal de diff de archivos */}
      {diffModalOpen && diffModalFile && (
        <DiffModal
          open={diffModalOpen}
          files={changes}
          initialFile={diffModalFile}
          onClose={() => setDiffModalOpen(false)}
          repoPath={repoPath}
        />
      )}
    </div>
  );
};

export default RepoTabLayout;
