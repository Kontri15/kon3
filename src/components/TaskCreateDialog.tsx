import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COMMON_TAGS = [
  "deepwork", "coding", "backend", "frontend", "meeting", 
  "personal", "urgent", "learning", "communication", "planning"
];

const ENERGY_LEVELS = [
  { value: 1, label: "Very Low", description: "Simple, mindless tasks" },
  { value: 2, label: "Low", description: "Easy tasks, light work" },
  { value: 3, label: "Medium", description: "Standard work" },
  { value: 4, label: "High", description: "Complex, demanding work" },
  { value: 5, label: "Very High", description: "Deep focus, intense work" }
];

export function TaskCreateDialog({ open, onOpenChange }: TaskCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("2");
  const [impact, setImpact] = useState("2");
  const [estMin, setEstMin] = useState("30");
  const [energyNeed, setEnergyNeed] = useState("2");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [project, setProject] = useState("");
  const [bizType, setBizType] = useState("personal");
  const [isCreating, setIsCreating] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleAddTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  const handleAddCustomTag = () => {
    if (customTag.trim() && !selectedTags.includes(customTag.trim())) {
      setSelectedTags([...selectedTags, customTag.trim()]);
      setCustomTag("");
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a task title",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase.from('tasks').insert([{
        user_id: '00000000-0000-0000-0000-000000000001', // Single-user app
        title: title.trim(),
        description: description.trim() || null,
        priority: parseInt(priority),
        impact: parseInt(impact),
        est_min: parseInt(estMin),
        energy_need: parseInt(energyNeed),
        min_block_min: 25,
        tags: selectedTags,
        project: project.trim() || null,
        due_at: dueDate?.toISOString() || null,
        location: 'ANY',
        status: 'todo',
        biz_or_personal: bizType as "biz" | "personal"
      }]);

      if (error) throw error;

      toast({
        title: "Task created!",
        description: `"${title}" has been added to your tasks.`
      });

      // Reset form
      setTitle("");
      setDescription("");
      setPriority("2");
      setImpact("2");
      setEstMin("30");
      setEnergyNeed("2");
      setSelectedTags([]);
      setDueDate(undefined);
      setProject("");
      setBizType("personal");
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "Failed to create task",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Additional details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Task Type */}
          <div className="space-y-2">
            <Label htmlFor="bizType">Typ úlohy</Label>
            <Select value={bizType} onValueChange={setBizType}>
              <SelectTrigger id="bizType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border-border z-50">
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="biz">PS:Digital</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority & Impact */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border z-50">
                  <SelectItem value="1">P1 - Low</SelectItem>
                  <SelectItem value="2">P2 - Normal</SelectItem>
                  <SelectItem value="3">P3 - Medium</SelectItem>
                  <SelectItem value="4">P4 - High</SelectItem>
                  <SelectItem value="5">P5 - Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="impact">Impact</Label>
              <Select value={impact} onValueChange={setImpact}>
                <SelectTrigger id="impact">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border z-50">
                  <SelectItem value="1">1 - Minimal</SelectItem>
                  <SelectItem value="2">2 - Low</SelectItem>
                  <SelectItem value="3">3 - Medium</SelectItem>
                  <SelectItem value="4">4 - High</SelectItem>
                  <SelectItem value="5">5 - Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration & Energy */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="5"
                step="5"
                value={estMin}
                onChange={(e) => setEstMin(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="energy">Energy Level</Label>
              <Select value={energyNeed} onValueChange={setEnergyNeed}>
                <SelectTrigger id="energy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border z-50">
                  {ENERGY_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value.toString()}>
                      {level.label} - {level.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-background border-border z-50" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Project */}
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Input
              id="project"
              placeholder="e.g., ChronoPilot, PS Digital"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-destructive" 
                    onClick={() => handleRemoveTag(tag)}
                  />
                </Badge>
              ))}
            </div>
            <Select onValueChange={handleAddTag}>
              <SelectTrigger>
                <SelectValue placeholder="Select tags..." />
              </SelectTrigger>
              <SelectContent className="bg-background border-border z-50">
                {COMMON_TAGS.filter(tag => !selectedTags.includes(tag)).map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Custom tag..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddCustomTag()}
              />
              <Button variant="outline" onClick={handleAddCustomTag}>
                Add
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
