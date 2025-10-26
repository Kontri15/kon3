import { Navigation } from "@/components/Navigation";
import { TimelineView } from "@/components/TimelineView";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const Today = () => {
  const [isPlanning, setIsPlanning] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handlePlanDay = async () => {
    setIsPlanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('plan-my-day');
      
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Navigation />
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
        <TimelineView />
      </div>
    </div>
  );
};

export default Today;
