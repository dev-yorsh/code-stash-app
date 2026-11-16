import React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal, Button } from "@/shared/ui";
import { useTranslation } from "@/shared/i18n";

export interface PermanentDeleteModalProps {
  snippetIds: string[] | null;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const PermanentDeleteModal: React.FC<PermanentDeleteModalProps> = ({
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
      title={t.modals.permanentDeleteTitle}
    >
      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-[var(--ayu-error)]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="text-[13px] font-medium">{t.modals.permanentDeleteBody}</p>
        </div>
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
