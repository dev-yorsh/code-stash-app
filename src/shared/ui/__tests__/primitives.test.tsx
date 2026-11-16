import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { Badge } from "../badge";
import { Button } from "../button";
import { Input } from "../input";
import { Modal } from "../modal";
import { Popover } from "../popover";

describe("Shared UI Primitives", () => {
  describe("Badge", () => {
    it("renders label and dot when provided", () => {
      render(<Badge color="#ff0000">TypeScript</Badge>);
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
    });

    it("triggers onClick when clicked", () => {
      const handleClick = vi.fn();
      render(<Badge onClick={handleClick}>Clickable</Badge>);
      fireEvent.click(screen.getByText("Clickable"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Button", () => {
    it("renders children and handles click", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);
      const btn = screen.getByRole("button", { name: "Click Me" });
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("disables button when isLoading is true", () => {
      const handleClick = vi.fn();
      render(<Button isLoading onClick={handleClick}>Save</Button>);
      const btn = screen.getByRole("button");
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("Input", () => {
    it("renders label and reflects typed value", () => {
      render(<Input label="Username" placeholder="Enter username" />);
      expect(screen.getByLabelText("Username")).toBeInTheDocument();
      const input = screen.getByPlaceholderText("Enter username");
      fireEvent.change(input, { target: { value: "alice" } });
      expect(input).toHaveValue("alice");
    });

    it("displays error message when provided", () => {
      render(<Input label="Email" error="Invalid email address" />);
      expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    });
  });

  describe("Modal", () => {
    it("renders when open and closes on escape key", () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Test Dialog">
          Modal Body Content
        </Modal>
      );
      expect(screen.getByText("Test Dialog")).toBeInTheDocument();
      expect(screen.getByText("Modal Body Content")).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("does not render when isOpen is false", () => {
      render(
        <Modal isOpen={false} onClose={() => {}} title="Test Dialog">
          Hidden Content
        </Modal>
      );
      expect(screen.queryByText("Hidden Content")).not.toBeInTheDocument();
    });
  });

  describe("Popover", () => {
    const PopoverTestWrapper = () => {
      const [open, setOpen] = useState(false);
      return (
        <Popover
          isOpen={open}
          onClose={() => setOpen(false)}
          trigger={<button onClick={() => setOpen(!open)}>Toggle</button>}
        >
          <div>Popover Body</div>
        </Popover>
      );
    };

    it("toggles content visibility on trigger click", () => {
      render(<PopoverTestWrapper />);
      expect(screen.queryByText("Popover Body")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
      expect(screen.getByText("Popover Body")).toBeInTheDocument();
    });
  });
});
