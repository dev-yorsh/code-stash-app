import React from "react";
import { Modal, Button } from "@/shared/ui";
import { useTranslation } from "@/shared/i18n";

export interface BatchSnippetDeleteModalProps {
  snippetIds: string[] | null;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const BatchSnippetDeleteModal: React.FC<BatchSnippetDeleteModalProps> = ({
  snippetIds,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  if (!snippetIds || snippetIds.length === 0) return null;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="sm"
      title={t.modals.batchSnippetDeleteTitle}
    >
      <div className="space-y-3">
        <p className="text-[13px] text-[var(--ayu-fg)] leading-normal">
          {t.modals.batchSnippetDeleteBody}
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
            {t.common.deleteAll}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
