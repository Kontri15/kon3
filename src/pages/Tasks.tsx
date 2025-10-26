import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Target, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";

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

const mockTasks: Task[] = [
  {
    id: "1",
    title: "Implement AI task decomposition",
    description: "Create an edge function that uses Lovable AI to break down complex tasks into actionable steps with time estimates. Include MVP path and risk analysis.",
    project: "ChronoPilot",
    priority: 4,
    impact: 5,
    dueDate: "2025-10-27",
    estMin: 90,
    tags: ["deepwork", "ai"],
  },
  {
    id: "2",
    title: "Design timeline drag & drop",
    description: "Implement interactive timeline with drag-and-drop functionality for rescheduling blocks. Support touch and mouse interactions.",
    project: "ChronoPilot",
    priority: 3,
    impact: 4,
    dueDate: "2025-10-28",
    estMin: 120,
    tags: ["ui", "deepwork"],
  },
  {
    id: "3",
    title: "Review Q4 team metrics",
    description: "Analyze team performance metrics for Q4 and prepare summary for leadership review.",
    project: "Work",
    priority: 2,
    impact: 3,
    dueDate: "2025-10-29",
    estMin: 45,
    tags: ["ops"],
  },
];

const Tasks = () => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
          <div className="space-y-3">
            {mockTasks.map((task) => (
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
                        <Badge variant="outline" className="text-xs">
                          {task.project}
                        </Badge>
                        {task.tags.map((tag) => (
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
                      {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-4 h-4" />
                      {task.estMin}m
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
