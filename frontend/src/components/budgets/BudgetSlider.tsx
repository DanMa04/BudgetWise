import { Slider } from "@base-ui/react/slider";

interface BudgetSliderProps {
  value: number;
  max: number;
  color: string;
  ghostMarkerValue?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export function BudgetSlider({
  value,
  max,
  color,
  ghostMarkerValue,
  disabled = false,
  onChange,
}: BudgetSliderProps) {
  const safeMax = Math.max(max, 1);
  const ghostPercent = ghostMarkerValue
    ? Math.min((ghostMarkerValue / safeMax) * 100, 100)
    : null;

  return (
    <Slider.Root
      value={value}
      min={0}
      max={safeMax}
      step={1}
      disabled={disabled}
      onValueChange={(val: number) => onChange(Math.round(val))}
      className="relative flex w-full touch-none items-center py-1"
    >
      <Slider.Control className="relative flex h-5 w-full items-center">
        <Slider.Track className="relative h-2 w-full rounded-full bg-muted">
          {ghostPercent !== null && (
            <div
              className="absolute top-0 h-full w-0.5 rounded-full bg-foreground/25"
              style={{ left: `${ghostPercent}%` }}
            />
          )}
          <Slider.Indicator
            className="absolute h-full rounded-full transition-all duration-150"
            style={{ backgroundColor: disabled ? "hsl(var(--muted-foreground))" : color }}
          />
          <Slider.Thumb className="block h-4 w-4 rounded-full border-2 border-background bg-foreground shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}
