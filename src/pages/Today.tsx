import { Navigation } from "@/components/Navigation";
import { TimelineView } from "@/components/TimelineView";
import { PlanFeedbackChat } from "@/components/PlanFeedbackChat";
import { BlockCreateDialog } from "@/components/BlockCreateDialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Sparkles, MessageSquare, ChevronDown, Plus } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";

const Today = () => {
  const [isPlanning, setIsPlanning] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current blocks for chat feedback
  const { data: currentBlocks = [] } = useQuery({
    queryKey: ['blocks'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('blocks')
        .select('*')
        .gte('start_at', `${today}T00:00:00`)
        .lt('start_at', `${today}T23:59:59`)
        .order('start_at');
      
      if (error) throw error;
      return data;
    },
  });

  const handlePlanDay = async () => {
    setIsPlanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('plan-my-day', {
        body: {}
      });
      
      if (error) throw error;
      
      toast({
        title: "Day planned!",
        description: `Created ${data.blocksCreated} time blocks for today.`,
      });
      
      // Refresh blocks
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
    } catch (error) {
      console.error('Error planning day:', error);
      toast({
        title: "Planning failed",
        description: error instanceof Error ? error.message : "Failed to plan your day",
        variant: "destructive",
      });
    } finally {
      setIsPlanning(false);
    }
  };

  const handleApplyChanges = async (newBlocks: any[]) => {
    try {
      // Delete existing blocks for today
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('blocks')
        .delete()
        .gte('start_at', `${today}T00:00:00`)
        .lt('start_at', `${today}T23:59:59`);

      // Insert new blocks
      const { error } = await supabase
        .from('blocks')
        .insert(newBlocks);

      if (error) throw error;

      // Refresh blocks
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      
      toast({
        title: "Schedule updated",
        description: "Your changes have been applied",
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Navigation />
          <div className="flex gap-2">
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Block
            </Button>
            <Button 
              onClick={() => setIsChatOpen(!isChatOpen)}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Feedback
            </Button>
            <Button 
              onClick={handlePlanDay} 
              disabled={isPlanning}
              size="lg"
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {isPlanning ? "Planning..." : "Plan My Day"}
            </Button>
          </div>
        </div>
        
        <TimelineView />
        
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
