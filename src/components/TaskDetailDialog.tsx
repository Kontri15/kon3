import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskDecomposition } from "./TaskDecomposition";
import { Badge } from "@/components/ui/badge";
import { Calendar, Target, Zap } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description?: string;
  project: string;
  priority: number;
  impact: number;
  dueDate: string;
  estMin: number;
  tags: string[];
}

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TaskDetailDialog = ({ task, open, onOpenChange }: TaskDetailDialogProps) => {
  if (!task) return null;

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
          {/* Meta Information */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{task.project}</Badge>
            {task.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="bg-secondary/20">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {new Date(task.dueDate).toLocaleDateString("en-US", { 
                  month: "short", 
                  day: "numeric",
                  year: "numeric" 
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{task.estMin}m</span>
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
