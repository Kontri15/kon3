import { Navigation } from "@/components/Navigation";
import { TimelineView } from "@/components/TimelineView";
import { PlanFeedbackChat } from "@/components/PlanFeedbackChat";
import { BlockCreateDialog } from "@/components/BlockCreateDialog";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Sparkles, MessageSquare, Plus, ChevronLeft, ChevronRight, Trash2, MoreVertical, Calendar, Zap, Target } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format, addDays } from "date-fns";

const Today = () => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
  const [isPlanning, setIsPlanning] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [planningNotes, setPlanningNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Fetch blocks for selected date for chat feedback
  const { data: currentBlocks = [] } = useQuery({
    queryKey: ['blocks', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('blocks')
        .select('*')
        .gte('start_at', `${dateStr}T00:00:00`)
        .lt('start_at', `${dateStr}T23:59:59`)
        .order('start_at');

      if (error) throw error;
      return data;
    },
  });

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'todo')
        .order('priority', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  const handlePlanDay = async () => {
    setIsPlanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('plan-my-day', {
        body: {
          targetDate: selectedDate.toISOString(),
          userNotes: planningNotes
        }
      });

      if (error) {
        // Extract the actual error message from the edge function
        const errorMessage = error.message || error.toString();
        throw new Error(errorMessage);
      }

      const dateStr = format(selectedDate, 'EEEE, MMM d');

      toast({
        title: "Day planned!",
        description: `Created ${data.blocksCreated} time blocks for ${dateStr}.`,
      });

      // Refresh blocks
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
    } catch (error) {
      console.error('Error planning day:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to plan your day";
      toast({
        title: "Planning failed",
        description: errorMessage.includes("Insufficient AI credits")
          ? "Not enough AI credits available. Please check your Lovable account."
          : errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsPlanning(false);
    }
  };

  const handleClearDay = async () => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const { error } = await supabase
        .from('blocks')
        .delete()
        .gte('start_at', `${dateStr}T00:00:00`)
        .lt('start_at', `${dateStr}T23:59:59`);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['blocks'] });

      const dateName = getDateLabel();
      toast({
        title: "Day cleared",
        description: `All blocks for ${dateName} have been removed`,
      });
    } catch (error) {
      console.error('Error clearing day:', error);
      toast({
        title: "Clear failed",
        description: error instanceof Error ? error.message : "Failed to clear day",
        variant: "destructive",
      });
    }
  };

  const handleApplyChanges = async (newBlocks: any[]) => {
    try {
      if (!newBlocks || newBlocks.length === 0) {
        throw new Error("No blocks to apply");
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Delete existing blocks for selected date
      const dateStr = selectedDate.toISOString().split('T')[0];
      const { error: deleteError } = await supabase
        .from('blocks')
        .delete()
        .gte('start_at', `${dateStr}T00:00:00`)
        .lt('start_at', `${dateStr}T23:59:59`);

      if (deleteError) throw deleteError;

      // Prepare blocks for insertion - ensure all required fields are present
      const blocksToInsert = newBlocks.map(block => ({
        ...block,
        user_id: user.id, // Ensure user_id is set
        id: undefined, // Let Supabase generate new IDs
        created_at: undefined, // Let Supabase set timestamps
        updated_at: undefined,
      }));

      // Insert new blocks
      const { error: insertError } = await supabase
        .from('blocks')
        .insert(blocksToInsert);

      if (insertError) throw insertError;

      // Refresh blocks
      queryClient.invalidateQueries({ queryKey: ['blocks'] });

      toast({
        title: "Schedule updated",
        description: `Applied changes to ${newBlocks.length} blocks`,
      });
    } catch (error) {
      console.error('Error applying changes:', error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update schedule",
        variant: "destructive",
      });
    }
  };

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const isTomorrow = format(selectedDate, 'yyyy-MM-dd') === format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const getDateLabel = () => {
    if (isToday) return "Today";
    if (isTomorrow) return "Tomorrow";
    return format(selectedDate, 'EEEE, MMM d');
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 4) return "bg-destructive/20 text-destructive border-destructive/30";
    if (priority >= 3) return "bg-warning/20 text-warning border-warning/30";
    return "bg-info/20 text-info border-info/30";
  };

  const getTaskTypeColor = (bizType?: string) => {
    if (bizType === "biz") {
      return "border-l-4 border-l-task-business bg-task-business/10";
    }
    return "border-l-4 border-l-task-personal bg-task-personal/10";
  };

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setTaskDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <Navigation>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="More actions" className="h-8 w-8 md:h-10 md:w-10">
                <MoreVertical className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Block
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsChatOpen(!isChatOpen)}>
                <MessageSquare className="w-4 h-4 mr-2" />
                {isChatOpen ? "Hide" : "Show"} Feedback
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleClearDay} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Day
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={handlePlanDay}
            disabled={isPlanning}
            size={isMobile ? "sm" : "sm"}
            className="gap-1.5 md:gap-2 text-xs md:text-sm px-2 md:px-4"
          >
            <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" />
            {isPlanning ? "Planning..." : isMobile ? "Plan" : `Plan ${isToday ? "Today" : isTomorrow ? "Tomorrow" : "Day"}`}
          </Button>
        </Navigation>

        {/* Date Navigation */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedDate(prev => addDays(prev, -1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-2xl font-bold text-foreground min-w-[240px] text-center">
            {getDateLabel()}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedDate(prev => addDays(prev, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Planning Notes */}
        <div className="mb-6 space-y-2">
          <Label htmlFor="planning-notes" className="text-sm font-medium">
            Planning Notes (optional)
          </Label>
          <Textarea
            id="planning-notes"
            placeholder="e.g., Had push day yesterday, ate bread with ham for dinner, need to focus on urgent MagicStyle tasks..."
            value={planningNotes}
            onChange={(e) => setPlanningNotes(e.target.value)}
            className="min-h-[80px] resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Provide context to help the AI plan your day better (recent workouts, meals, priorities, etc.)
          </p>
        </div>

        {/* Tasks Section */}
        {tasks.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Pending Tasks</h3>
              <Button variant="ghost" size="sm" onClick={() => window.location.href = '/tasks'}>
                View All
              </Button>
            </div>
            <div className="space-y-2">
              {tasks.map((task) => (
                <Card 
                  key={task.id} 
                  className={`glass border-border p-4 hover:border-primary/30 transition-all cursor-pointer ${getTaskTypeColor(task.biz_or_personal)}`}
                  onClick={() => handleTaskClick(task)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{task.title}</h4>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {task.due_at && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(task.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                        )}
                        {task.est_min && (
                          <div className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {task.est_min}m
                          </div>
                        )}
                        {task.impact && (
                          <div className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {task.impact}/5
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge className={getPriorityColor(task.priority)} variant="outline">
                      P{task.priority}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <TimelineView date={selectedDate} />

        <Collapsible open={isChatOpen} onOpenChange={setIsChatOpen} className="mt-6">
          <CollapsibleContent>
            <PlanFeedbackChat
              currentBlocks={currentBlocks}
              onApplyChanges={handleApplyChanges}
            />
          </CollapsibleContent>
        </Collapsible>

        <BlockCreateDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
        <TaskDetailDialog
          task={selectedTask}
          open={taskDetailOpen}
          onOpenChange={setTaskDetailOpen}
        />
      </div>
    </div>
  );
};

export default Today;
