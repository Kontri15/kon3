import { Navigation } from "@/components/Navigation";
import { TimelineView } from "@/components/TimelineView";
import { PlanFeedbackChat } from "@/components/PlanFeedbackChat";
import { BlockCreateDialog } from "@/components/BlockCreateDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Sparkles, MessageSquare, Plus, ChevronLeft, ChevronRight, Trash2, MoreVertical } from "lucide-react";
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
  const [planningNotes, setPlanningNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <Navigation>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="More actions">
                <MoreVertical className="w-5 h-5" />
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
            size="sm"
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {isPlanning ? "Planning..." : `Plan ${isToday ? "Today" : isTomorrow ? "Tomorrow" : "Day"}`}
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
      </div>
    </div>
  );
};

export default Today;
