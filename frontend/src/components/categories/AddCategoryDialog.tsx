import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCreateCategory } from "@/hooks/useCategories";
import type { Category } from "@/types/models";

const PRESET_COLORS = [
  "#4F46E5", "#0891B2", "#16A34A", "#EA580C", "#9333EA",
  "#E11D48", "#DC2626", "#CA8A04", "#2563EB", "#7C3AED",
  "#DB2777", "#6366F1", "#0D9488", "#F59E0B", "#3B82F6",
  "#0F766E", "#6B7280",
];

const PRESET_ICONS = [
  "home", "car", "shopping-cart", "utensils", "film",
  "shopping-bag", "heart-pulse", "zap", "shield", "book-open",
  "smile", "repeat", "plane", "gift", "briefcase",
  "laptop", "trending-up", "plus-circle", "more-horizontal",
  "coffee", "music", "phone", "wifi", "dollar-sign",
];

interface AddCategoryDialogProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
}

export function AddCategoryDialog({
  open,
  onClose,
  categories,
}: AddCategoryDialogProps) {
  const create = useCreateCategory();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const [isIncome, setIsIncome] = useState(false);
  const [parentId, setParentId] = useState("");

  const parentOptions = categories.filter(
    (c) => !c.is_income && !c.parent_id
  );

  function reset() {
    setName("");
    setColor(PRESET_COLORS[0]);
    setIcon(PRESET_ICONS[0]);
    setIsIncome(false);
    setParentId("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    create.mutate(
      {
        name: name.trim(),
        color,
        icon,
        is_income: isIncome,
        ...(parentId && !isIncome ? { parent_id: parentId } : {}),
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open}>
      <DialogContent onClose={handleClose}>
        <DialogHeader>
          <DialogTitle>Add Category</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Coffee"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- dialog input should receive focus on open
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={!isIncome ? "default" : "outline"}
                size="sm"
                onClick={() => setIsIncome(false)}
              >
                Expense
              </Button>
              <Button
                type="button"
                variant={isIncome ? "default" : "outline"}
                size="sm"
                onClick={() => setIsIncome(true)}
              >
                Income
              </Button>
            </div>
          </div>

          {!isIncome && parentOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="cat-parent">Parent Category (optional)</Label>
              <Select
                id="cat-parent"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">None (standalone)</option>
                {parentOptions.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    color === c
                      ? "border-foreground scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-icon">Icon</Label>
            <Select
              id="cat-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
            >
              {PRESET_ICONS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? "Adding..." : "Add Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
