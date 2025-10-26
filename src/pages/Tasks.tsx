import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Target, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Task {
  id: string;
  title: string;
  description?: string;
  project?: string;
  priority: number;
  impact: number;
  due_at?: string;
  est_min?: number;
  tags?: string[];
}

const Tasks = () => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'todo')
        .order('priority', { ascending: false });
      
      if (error) throw error;
      return data as Task[];
    },
  });

  const getPriorityColor = (priority: number) => {
    if (priority >= 4) return "bg-destructive/20 text-destructive border-destructive/30";
    if (priority >= 3) return "bg-warning/20 text-warning border-warning/30";
    return "bg-info/20 text-info border-info/30";
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <Navigation />

        <div className="space-y-6 animate-fade-in">
          {/* Quick Add */}
          <Card className="glass border-border p-4">
            <div className="flex gap-2">
              <Input
                placeholder="/task Build edge function [due:2025-10-27] [min:90] [tag:deepwork]"
                className="flex-1 bg-surface border-border"
              />
              <Button size="icon">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </Card>

          {/* Task List */}
          {isLoading ? (
            <div className="text-center py-8">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tasks yet. Add your first task to get started!
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
              <Card 
                key={task.id} 
                className="glass border-border p-5 hover:border-primary/30 transition-all cursor-pointer"
                onClick={() => handleTaskClick(task)}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <h3 className="text-lg font-semibold">{task.title}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        {task.project && (
                          <Badge variant="outline" className="text-xs">
                            {task.project}
                          </Badge>
                        )}
                        {task.tags?.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs bg-secondary/20">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge className={getPriorityColor(task.priority)}>P{task.priority}</Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {task.due_at ? new Date(task.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No date"}
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-4 h-4" />
                      {task.est_min || 60}m
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      Impact: {task.impact}/5
                    </div>
                  </div>

                </div>
              </Card>
              ))}
            </div>
          )}

          {/* Task Detail Dialog */}
          <TaskDetailDialog
            task={selectedTask}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
          />
        </div>
      </div>
    </div>
  );
};

export default Tasks;
