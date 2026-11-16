import React from "react";
import { Snippet, Folder, Tag, CreateSnippetInput, UpdateSnippetInput } from "@/core/types";
import { SnippetEditor } from "./SnippetEditor";
import { useTranslation } from "@/shared/i18n";

export interface SnippetWorkspaceProps {
  snippet: Snippet | null;
  isCreating: boolean;
  folder?: Folder | null;
  tags: Tag[];
  activeFolderId?: string | null;
  searchQuery?: string;
  isTrashView?: boolean;
  onAutoSave: (
    data: CreateSnippetInput | UpdateSnippetInput,
    existingId: string | null
  ) => Promise<Snippet>;
  onDelete?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
}

export const SnippetWorkspace: React.FC<SnippetWorkspaceProps> = React.memo(({
  snippet,
  isCreating,
  folder,
  tags,
  activeFolderId,
  searchQuery,
  isTrashView = false,
  onAutoSave,
  onDelete,
  onToggleFavorite,
}) => {
  const { t } = useTranslation();

  return (
    <main className="flex-1 min-w-0 h-full overflow-hidden bg-[var(--editor-panel-bg)]">
      {snippet || isCreating ? (
        <SnippetEditor
          key={snippet?.id || "new-draft"}
          snippet={snippet}
          folder={folder}
          tags={tags}
          activeFolderId={activeFolderId}
          searchQuery={searchQuery}
          onAutoSave={onAutoSave}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
        />
      ) : (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[var(--ayu-fg)] select-none bg-[var(--editor-panel-bg)]">
          <p className="text-sm font-medium text-[var(--ayu-editor-fg)]">
            {isTrashView
              ? t.workspace.trashSelectedTitle
              : t.workspace.noSnippetSelectedTitle}
          </p>
          <p className="text-xs text-[var(--ayu-fg-subtle)] mt-1">
            {isTrashView
              ? t.workspace.trashSelectedSubtitle
              : t.workspace.noSnippetSelectedSubtitle}
          </p>
        </div>
      )}
    </main>
  );
});
SnippetWorkspace.displayName = "SnippetWorkspace";
