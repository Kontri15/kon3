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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Target, Zap, CheckCircle2, Circle, Pencil, X } from "lucide-react";
import { useState, useEffect } from "react";
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
  biz_or_personal?: string;
}

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TaskDetailDialog = ({ task, open, onOpenChange }: TaskDetailDialogProps) => {
  const [actualMin, setActualMin] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProject, setEditProject] = useState("");
  const [editPriority, setEditPriority] = useState(2);
  const [editImpact, setEditImpact] = useState(2);
  const [editEstMin, setEditEstMin] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editBizType, setEditBizType] = useState("personal");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize edit form when task changes
  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description || "");
      setEditProject(task.project || "");
      setEditPriority(task.priority);
      setEditImpact(task.impact);
      setEditEstMin(task.est_min?.toString() || "");
      setEditDueAt(task.due_at ? new Date(task.due_at).toISOString().split('T')[0] : "");
      setEditTags(task.tags || []);
      setEditBizType(task.biz_or_personal || "personal");
    }
  }, [task]);

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

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      toast({
        title: "Title required",
        description: "Task title cannot be empty",
        variant: "destructive"
      });
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editTitle,
          description: editDescription || null,
          project: editProject || null,
          priority: editPriority,
          impact: editImpact,
          est_min: editEstMin ? parseInt(editEstMin) : null,
          due_at: editDueAt ? new Date(editDueAt).toISOString() : null,
          tags: editTags.length > 0 ? editTags : null,
          biz_or_personal: editBizType as "biz" | "personal",
        })
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: "Task updated!",
        description: "Your changes have been saved"
      });

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsEditing(false);
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

  const handleRemoveTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(tag => tag !== tagToRemove));
  };

  const handleAddTag = (tag: string) => {
    if (tag && !editTags.includes(tag)) {
      setEditTags([...editTags, tag]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass border-border">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-xl font-semibold"
                    placeholder="Task title"
                  />
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Task description"
                    rows={3}
                  />
                </div>
              ) : (
                <>
                  <DialogTitle className="text-xl">{task.title}</DialogTitle>
                  <DialogDescription>
                    {task.description || "No description provided"}
                  </DialogDescription>
                </>
              )}
            </div>
            {!isDone && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(!isEditing)}
                className="ml-2"
              >
                {isEditing ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              </Button>
            )}
          </div>
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

          {/* Editable Fields or Meta Information */}
          {isEditing ? (
            <div className="space-y-4 p-4 rounded-lg bg-surface/50 border border-border">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Typ úlohy</Label>
                  <Select value={editBizType} onValueChange={setEditBizType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border z-50">
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="biz">PS:Digital</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Project</Label>
                  <Input
                    value={editProject}
                    onChange={(e) => setEditProject(e.target.value)}
                    placeholder="Project name"
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={editDueAt}
                    onChange={(e) => setEditDueAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Priority (1-5)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={editPriority}
                    onChange={(e) => setEditPriority(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label>Impact (1-5)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={editImpact}
                    onChange={(e) => setEditImpact(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label>Est. Minutes</Label>
                  <Input
                    type="number"
                    value={editEstMin}
                    onChange={(e) => setEditEstMin(e.target.value)}
                    placeholder="60"
                  />
                </div>
              </div>

              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {editTags.map((tag) => (
                    <Badge 
                      key={tag} 
                      variant="secondary" 
                      className="bg-secondary/20 cursor-pointer"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      {tag} <X className="w-3 h-3 ml-1" />
                    </Badge>
                  ))}
                  <Input
                    placeholder="Add tag (press Enter)"
                    className="w-40 h-8"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddTag(e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveEdit} disabled={isUpdating}>
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
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
                  <span className="text-muted-foreground">
                    Priority: {task.priority}/5 | Impact: {task.impact}/5
                  </span>
                </div>
              </div>
            </>
          )}

          {/* AI Decomposition */}
          <div className="pt-4 border-t border-border">
            <TaskDecomposition task={task} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
