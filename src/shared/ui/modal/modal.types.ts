import { ReactNode } from "react";
import { type VariantProps } from "class-variance-authority";
import { modalVariants } from "./modal.variants";

export interface ModalProps extends VariantProps<typeof modalVariants> {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  closeOnOverlayClick?: boolean;
}
