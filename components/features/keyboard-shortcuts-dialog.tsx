"use client";

import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  { keys: ["⌘", "I"], description: "Toggle AI chat" },
  { keys: ["⌘", "⇧", "H"], description: "Toggle history sidebar" },
  { keys: ["⌘", "⇧", "N"], description: "New chat thread" },
  { keys: ["⌘", "⇧", "C"], description: "Copy last AI response" },
  { keys: ["Esc"], description: "Stop AI generation" },
  { keys: ["?"], description: "Toggle this dialog" },
  { keys: ["/"], description: "Focus chat input" },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Quick actions to navigate and control the app.
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 pb-4">
          <ul className="space-y-2">
            {shortcuts.map((shortcut, index) => (
              <li
                key={index}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-foreground">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, keyIndex) => (
                    <Kbd key={keyIndex}>{key}</Kbd>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
