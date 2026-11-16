import React, { useState, useEffect } from "react";
import { Modal, Input, Button } from "@/shared/ui";
import { Folder } from "@/core/types";

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, icon?: string, parentId?: string | null) => Promise<void>;
  folderToEdit?: Folder | null;
  parentFolder?: Folder | null;
}

export const FolderModal: React.FC<FolderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  folderToEdit,
  parentFolder,
}) => {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (folderToEdit) {
      setName(folderToEdit.name);
    } else {
      setName("");
    }
    setError("");
  }, [folderToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Folder name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(name.trim(), "folder", parentFolder?.id || null);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save folder");
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle = folderToEdit
    ? "Editar Carpeta"
    : parentFolder
      ? `Nueva Subcarpeta en «${parentFolder.name}»`
      : "Nueva Carpeta";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Folder Name"
          placeholder="e.g. Frontend, Algorithms, DevOps..."
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setName(e.target.value);
            if (error) setError("");
          }}
          error={error}
          autoFocus
        />
        <div className="flex justify-end space-x-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {folderToEdit ? "Save Changes" : "Create Folder"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
