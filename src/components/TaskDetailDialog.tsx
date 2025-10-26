import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskDecomposition } from "./TaskDecomposition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Target, Zap, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Task {
  id: string;
  title: string;
  description?: string;
  project?: string;
  priority: number;
  impact: number;
  due_at?: string;
  est_min?: number;
  actual_min?: number;
  status?: string;
  tags?: string[];
}

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TaskDetailDialog = ({ task, open, onOpenChange }: TaskDetailDialogProps) => {
  const [actualMin, setActualMin] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!task) return null;

  const isDone = task.status === 'done';

  const handleToggleComplete = async () => {
    if (!isDone && !actualMin) {
      toast({
        title: "Actual time required",
        description: "Please enter how many minutes the task actually took",
        variant: "destructive"
      });
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: isDone ? 'todo' : 'done',
          actual_min: isDone ? null : parseInt(actualMin)
        })
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: isDone ? "Task reopened" : "Task completed!",
        description: isDone 
          ? `"${task.title}" is now in progress`
          : `"${task.title}" completed in ${actualMin} minutes`
      });

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setActualMin("");
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Failed to update task",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass border-border">
        <DialogHeader>
          <DialogTitle className="text-xl">{task.title}</DialogTitle>
          <DialogDescription>
            {task.description || "No description provided"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Completion Status */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-surface/50 border border-border">
            <div className="flex-1">
              {isDone ? (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="w-5 h-5" />
                  <div>
                    <p className="font-semibold">Task Completed</p>
                    {task.actual_min && (
                      <p className="text-sm text-muted-foreground">
                        Took {task.actual_min} minutes
                        {task.est_min && ` (estimated: ${task.est_min}m)`}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Circle className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <Label htmlFor="actual-min">Mark as complete</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="actual-min"
                        type="number"
                        placeholder="Actual minutes"
                        value={actualMin}
                        onChange={(e) => setActualMin(e.target.value)}
                        className="w-40"
                        min="1"
                      />
                      <Button 
                        onClick={handleToggleComplete}
                        disabled={isUpdating || !actualMin}
                        size="sm"
                      >
                        Complete
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {isDone && (
              <Button 
                variant="outline" 
                onClick={handleToggleComplete}
                disabled={isUpdating}
              >
                Reopen
              </Button>
            )}
          </div>

          {/* Meta Information */}
          <div className="flex flex-wrap gap-2">
            {task.project && <Badge variant="outline">{task.project}</Badge>}
            {task.tags?.map((tag) => (
              <Badge key={tag} variant="secondary" className="bg-secondary/20">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {task.due_at ? new Date(task.due_at).toLocaleDateString("en-US", { 
                  month: "short", 
                  day: "numeric",
                  year: "numeric" 
                }) : "No date"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{task.est_min || 60}m</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Impact: {task.impact}/5</span>
            </div>
          </div>

          {/* AI Decomposition */}
          <div className="pt-4 border-t border-border">
            <TaskDecomposition task={task} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
