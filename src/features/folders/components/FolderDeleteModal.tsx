import React from "react";
import { Folder } from "@/core/types";
import { Modal, Button } from "@/shared/ui";
import { useTranslation } from "@/shared/i18n";

export interface FolderDeleteModalProps {
  foldersToDelete: Folder[] | null;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const FolderDeleteModal: React.FC<FolderDeleteModalProps> = ({
  foldersToDelete,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  if (!foldersToDelete || foldersToDelete.length === 0) return null;

  const isSingle = foldersToDelete.length === 1;
  const title = isSingle
    ? t.modals.folderDeleteSingleTitle(foldersToDelete[0].name)
    : t.modals.folderDeleteMultiTitle;

  return (
    <Modal isOpen={true} onClose={onClose} size="sm" title={title}>
      <div className="space-y-3">
        <p className="text-[13px] text-[var(--ayu-fg)] leading-normal">
          {isSingle
            ? t.modals.folderDeleteSingleBody
            : t.modals.folderDeleteMultiBody}
        </p>
        <div className="flex justify-end space-x-2 pt-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {t.common.delete}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
