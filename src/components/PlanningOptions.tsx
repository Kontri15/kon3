import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Utensils, Dumbbell } from "lucide-react";
import { useState } from "react";

interface PlanningOptionsProps {
  lunchMeal: string;
  dinnerMeal: string;
  workoutType: string;
  onLunchChange: (value: string) => void;
  onDinnerChange: (value: string) => void;
  onWorkoutChange: (value: string) => void;
}

// Meal options based on plan-my-day prompt
const LUNCH_OPTIONS = [
  { value: "", label: "Auto (let code decide)" },
  { value: "Rice with salmon", label: "Rice with salmon" },
  { value: "Rice with chicken", label: "Rice with chicken" },
  { value: "Rice with steak", label: "Rice with steak" },
  { value: "Rice with tuna", label: "Rice with tuna" },
  { value: "Potatoes with salmon", label: "Potatoes with salmon" },
  { value: "Potatoes with chicken", label: "Potatoes with chicken" },
  { value: "Potatoes with steak", label: "Potatoes with steak" },
  { value: "Potatoes with turkey", label: "Potatoes with turkey" },
  { value: "Pasta with tuna", label: "Pasta with tuna" },
  { value: "Pasta with chicken", label: "Pasta with chicken" },
  { value: "Fries with chicken", label: "Fries with chicken" },
  { value: "Fries with steak", label: "Fries with steak" },
  { value: "Legumes with rice", label: "Legumes with rice" },
];

const DINNER_OPTIONS = [
  { value: "", label: "Auto (let code decide)" },
  { value: "Bread with ham", label: "Bread with ham" },
  { value: "Bread with eggs", label: "Bread with eggs" },
  { value: "Bread with cheese", label: "Bread with cheese" },
  { value: "Yogurt with cereals", label: "Yogurt with cereals" },
  { value: "Yogurt with fruit", label: "Yogurt with fruit" },
];

const WORKOUT_OPTIONS = [
  { value: "", label: "Auto (follow cycle)" },
  { value: "Push", label: "Push" },
  { value: "Pull", label: "Pull" },
  { value: "Legs", label: "Legs" },
  { value: "Active/Rest", label: "Active/Rest" },
  { value: "Swimming", label: "Swimming" },
  { value: "Hockey", label: "Hockey" },
  { value: "Skip", label: "Skip (no workout)" },
];

export function PlanningOptions({
  lunchMeal,
  dinnerMeal,
  workoutType,
  onLunchChange,
  onDinnerChange,
  onWorkoutChange,
}: PlanningOptionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasSelections = lunchMeal || dinnerMeal || workoutType;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border border-border rounded-lg">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Utensils className="w-4 h-4 text-muted-foreground" />
          <span>Planning Options</span>
          {hasSelections && (
            <span className="text-xs text-muted-foreground">
              ({[lunchMeal, dinnerMeal, workoutType].filter(Boolean).length} selected)
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      
      <CollapsibleContent className="p-4 pt-0 space-y-4">
        <p className="text-xs text-muted-foreground">
          Pre-select your meals and workout. Leave on "Auto" for code-based defaults.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Lunch Selection */}
          <div className="space-y-2">
            <Label htmlFor="lunch-meal" className="text-sm flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5" />
              Lunch
            </Label>
            <Select value={lunchMeal} onValueChange={onLunchChange}>
              <SelectTrigger id="lunch-meal" className="w-full">
                <SelectValue placeholder="Auto (let code decide)" />
              </SelectTrigger>
              <SelectContent>
                {LUNCH_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value || "auto"}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dinner Selection */}
          <div className="space-y-2">
            <Label htmlFor="dinner-meal" className="text-sm flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5" />
              Dinner
            </Label>
            <Select value={dinnerMeal} onValueChange={onDinnerChange}>
              <SelectTrigger id="dinner-meal" className="w-full">
                <SelectValue placeholder="Auto (let code decide)" />
              </SelectTrigger>
              <SelectContent>
                {DINNER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value || "auto"}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Workout Selection */}
          <div className="space-y-2">
            <Label htmlFor="workout-type" className="text-sm flex items-center gap-1.5">
              <Dumbbell className="w-3.5 h-3.5" />
              Workout
            </Label>
            <Select value={workoutType} onValueChange={onWorkoutChange}>
              <SelectTrigger id="workout-type" className="w-full">
                <SelectValue placeholder="Auto (follow cycle)" />
              </SelectTrigger>
              <SelectContent>
                {WORKOUT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value || "auto"}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
