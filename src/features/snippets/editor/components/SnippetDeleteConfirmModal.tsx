import React from "react";
import { Modal, Button } from "@/shared/ui";
import { useTranslation } from "@/shared/i18n";

export interface SnippetDeleteConfirmModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const SnippetDeleteConfirmModal: React.FC<SnippetDeleteConfirmModalProps> = ({
  isOpen,
  title,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={t.modals.snippetDeleteTitle}
    >
      <div className="space-y-3">
        <p className="text-[13px] text-[var(--ayu-fg)] leading-normal">
          {t.modals.snippetDeleteBodyPrefix}{" "}
          <strong className="text-[var(--ayu-editor-fg)]">
            "{title || t.snippetList.untitledSnippet}"
          </strong>
          {t.modals.snippetDeleteBodySuffix}
        </p>
        <div className="flex justify-end space-x-2 pt-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
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
