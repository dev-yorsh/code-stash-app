import React, { useState } from "react";
import { Modal, Input, Button } from "@/shared/ui";
import { PRESET_TAG_COLORS } from "../constants";
import { TagGlyph } from "./TagGlyph";
import { useTranslation } from "@/shared/i18n";

export interface TagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, color: string) => Promise<void>;
}

export const TagModal: React.FC<TagModalProps> = ({ isOpen, onClose, onSave }) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PRESET_TAG_COLORS[4]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t.tagModal.nameRequiredError);
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(name.trim().toLowerCase(), color);
      setName("");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.tagModal.createFailedError;
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.tagModal.title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t.tagModal.nameLabel}
          placeholder={t.tagModal.namePlaceholder}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError("");
          }}
          error={error}
          autoFocus
        />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[var(--ayu-fg)]">
              {t.tagModal.colorLabel}
            </label>
            <TagGlyph color={color} className="w-4 h-4" />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {PRESET_TAG_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                  color === c ? "ring-2 ring-white scale-110" : "opacity-70 hover:opacity-100"
                }`}
                aria-label={t.sidebar.selectColorAria(c)}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {t.tagModal.createButton}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
