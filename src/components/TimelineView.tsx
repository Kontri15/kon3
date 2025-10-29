import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Zap, CheckCircle2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlockDetailDialog } from "./BlockDetailDialog";
import { RoutineContainerComponent } from "./RoutineContainer";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface TimeBlock {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  type: "task" | "ritual" | "event" | "meal" | "break" | "buffer" | "commute" | "sleep";
  status: string;
  task_id?: string;
  ritual_id?: string;
  notes?: string;
}

interface RoutineContainer {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  blocks: TimeBlock[];
  type: 'routine';
}

type TimelineItem = TimeBlock | RoutineContainer;

export const TimelineView = () => {
  const [selectedBlock, setSelectedBlock] = useState<TimeBlock | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actualMinutes, setActualMinutes] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper function to calculate block duration (defined before usage)
  const getBlockDuration = (block: TimeBlock) => {
    const start = parseISO(block.start_at);
    const end = parseISO(block.end_at);
    const durationMs = end.getTime() - start.getTime();
    return Math.max(durationMs / (1000 * 60), 1); // Return minutes, minimum 1
  };

  // Group micro-blocks into routine containers
  const groupMicroBlocks = (blocks: TimeBlock[]): TimelineItem[] => {
    if (!blocks || blocks.length === 0) return [];
    
    const sortedBlocks = [...blocks].sort((a, b) => 
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );
    
    const grouped: TimelineItem[] = [];
    let currentGroup: TimeBlock[] = [];
    let groupStart: string | null = null;
    
    const inferRoutineName = (blocks: TimeBlock[]): string => {
      const firstBlockTime = new Date(blocks[0].start_at);
      const hour = firstBlockTime.getHours();
      
      if (hour >= 6 && hour < 9) return "Morning Routine";
      if (hour >= 21 && hour < 23) return "Evening Wind-down";
      if (blocks.some(b => b.type === 'meal')) return "Meal Prep";
      return "Quick Tasks";
    };
    
    sortedBlocks.forEach((block, index) => {
      const duration = getBlockDuration(block);
      const isLastBlock = index === sortedBlocks.length - 1;
      
      // Check if next block is close by (within 5 minutes gap) and also micro
      const nextBlock = sortedBlocks[index + 1];
      const gapToNext = nextBlock 
        ? (new Date(nextBlock.start_at).getTime() - new Date(block.end_at).getTime()) / 60000 
        : Infinity;
      const isNextClose = gapToNext <= 5; // Allow 5 minute gaps
      const isNextMicro = nextBlock && getBlockDuration(nextBlock) < 15;
      
      // Micro blocks are < 15 minutes
      const isMicro = duration < 15;
      
      if (isMicro && isNextClose && isNextMicro) {
        // Start or continue a group
        if (currentGroup.length === 0) groupStart = block.start_at;
        currentGroup.push(block);
      } else if (isMicro && currentGroup.length > 0) {
        // Last micro block in a group - add it and close group
        currentGroup.push(block);
        
        // Only create routine container if 2+ blocks (lowered from 3)
        if (currentGroup.length >= 2) {
          grouped.push({
            id: `routine-${groupStart}`,
            title: inferRoutineName(currentGroup),
            start_at: groupStart!,
            end_at: currentGroup[currentGroup.length - 1].end_at,
            blocks: currentGroup,
            type: 'routine'
          });
        } else {
          grouped.push(...currentGroup);
        }
        
        currentGroup = [];
        groupStart = null;
      } else {
        // Not a micro block or doesn't fit group pattern
        // Flush current group if exists
        if (currentGroup.length >= 2) {
          grouped.push({
            id: `routine-${groupStart}`,
            title: inferRoutineName(currentGroup),
            start_at: groupStart!,
            end_at: currentGroup[currentGroup.length - 1].end_at,
            blocks: currentGroup,
            type: 'routine'
          });
        } else if (currentGroup.length > 0) {
          grouped.push(...currentGroup);
        }
        
        // Add this non-micro block
        grouped.push(block);
        currentGroup = [];
        groupStart = null;
      }
      
      // Handle last block edge case
      if (isLastBlock && currentGroup.length > 0) {
        if (currentGroup.length >= 2) {
          grouped.push({
            id: `routine-${groupStart}`,
            title: inferRoutineName(currentGroup),
            start_at: groupStart!,
            end_at: currentGroup[currentGroup.length - 1].end_at,
            blocks: currentGroup,
            type: 'routine'
          });
        } else {
          grouped.push(...currentGroup);
        }
      }
    });
    
    console.log('🔍 Grouped micro-blocks:', {
      totalBlocks: sortedBlocks.length,
      groupedItems: grouped.length,
      routineContainers: grouped.filter(item => 'blocks' in item).length,
      individualBlocks: grouped.filter(item => !('blocks' in item)).length
    });
    
    return grouped;
  };
  
  const hours = Array.from({ length: 24 }, (_, i) => (i + 6) % 24); // 6 AM to 6 AM next day
  const PIXELS_PER_MINUTE = 2; // 120px per hour for better readability
  const TIMELINE_START_HOUR = 6; // 6 AM
  
  const { data: rawBlocks = [], isLoading } = useQuery({
    queryKey: ['blocks', new Date().toDateString()],
    queryFn: async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const nextDay = String(now.getDate() + 1).padStart(2, '0');
      
      // Detect DST for Europe/Bratislava
      const jan = new Date(now.getFullYear(), 0, 1);
      const jul = new Date(now.getFullYear(), 6, 1);
      const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
      const isDST = now.getTimezoneOffset() < stdOffset;
      const offset = isDST ? '+02:00' : '+01:00';
      
      // Create ISO strings with proper timezone offset
      const queryStartTime = `${year}-${month}-${day}T06:00:00${offset}`;
      const queryEndTime = `${year}-${month}-${nextDay}T06:00:00${offset}`;
      
      const { data, error } = await supabase
        .from('blocks')
        .select(`
          *,
          task:tasks(id, title, est_min, status)
        `)
        .gte('start_at', queryStartTime)
        .lt('start_at', queryEndTime)
        .order('start_at');
        
      if (error) throw error;
      return data as TimeBlock[];
    },
    refetchInterval: 30000,
  });

  const timelineItems = groupMicroBlocks(rawBlocks);
  const blocks = rawBlocks;

  const formatTimeFromLocal = (isoString: string) => {
    const date = new Date(isoString);
    return format(date, 'HH:mm');
  };

  const getBlockDurationFormatted = (start: string, end: string) => {
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    const durationMs = endDate.getTime() - startDate.getTime();
    const minutes = Math.round(durationMs / (1000 * 60));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const currentBlock = blocks.find(b => {
    const now = new Date();
    const start = parseISO(b.start_at);
    const end = parseISO(b.end_at);
    return now >= start && now <= end;
  });
  
  const getBlockColor = (type: TimeBlock["type"]) => {
    const colors = {
      task: "bg-block-task border-l-blue-500",
      ritual: "bg-block-ritual border-l-purple-500",
      event: "bg-block-event border-l-green-500",
      meal: "bg-block-meal border-l-orange-500",
      break: "bg-card/50 border-l-gray-400",
      buffer: "bg-yellow-500/10 border-l-yellow-500",
      commute: "bg-cyan-500/10 border-l-cyan-500",
      sleep: "bg-indigo-500/10 border-l-indigo-500",
    };
    return colors[type] || colors.task;
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading your schedule...</div>;
  }

  const handleBlockClick = (block: TimeBlock) => {
    setSelectedBlock(block);
    setDialogOpen(true);
  };

  const handleMarkDone = async () => {
    if (!currentBlock?.task_id) {
      toast({
        title: "Cannot complete",
        description: "This block is not linked to a task. Re-run 'Plan My Day' to link tasks.",
        variant: "destructive"
      });
      return;
    }

    const minutes = parseInt(actualMinutes);
    if (isNaN(minutes) || minutes <= 0) {
      toast({
        title: "Invalid input",
        description: "Please enter a valid number of minutes",
        variant: "destructive"
      });
      return;
    }

    setIsUpdating(true);
    try {
      // Update task status and actual_min
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status: 'done',
          actual_min: minutes
        })
        .eq('id', currentBlock.task_id);

      if (taskError) throw taskError;

      // Update block status
      const { error: blockError } = await supabase
        .from('blocks')
        .update({ status: 'done' })
        .eq('id', currentBlock.id);

      if (blockError) throw blockError;

      toast({
        title: "Task completed!",
        description: `Completed in ${minutes} minutes`
      });

      setActualMinutes("");
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
    } catch (error) {
      console.error('Error marking task done:', error);
      toast({
        title: "Failed to update",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkNotDone = async () => {
    if (!currentBlock || !currentBlock.task_id) {
      return;
    }

    setIsUpdating(true);
    try {
      // Update task status back to todo
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status: 'todo',
          actual_min: null
        })
        .eq('id', currentBlock.task_id);

      if (taskError) throw taskError;

      // Update block status
      const { error: blockError } = await supabase
        .from('blocks')
        .update({ status: 'planned' })
        .eq('id', currentBlock.id);

      if (blockError) throw blockError;

      toast({
        title: "Task reopened",
        description: "Task marked as not done"
      });

      queryClient.invalidateQueries({ queryKey: ['blocks'] });
    } catch (error) {
      console.error('Error marking task not done:', error);
      toast({
        title: "Failed to update",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    try {
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('id', blockId);

      if (error) throw error;

      toast({
        title: "Block deleted",
        description: "The block has been removed from your schedule"
      });

      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      setDialogOpen(false);
    } catch (error) {
      console.error('Error deleting block:', error);
      toast({
        title: "Failed to delete",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <BlockDetailDialog 
        block={selectedBlock}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onDelete={handleDeleteBlock}
      />

      {/* Current Block Card */}
      {currentBlock && (
        <Card className={`glass p-6 ${currentBlock.status === 'done' ? 'border-success/50' : 'border-primary/30'}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-secondary/20 text-secondary-foreground">
                  <Zap className="w-3 h-3 mr-1" />
                  Active Now
                </Badge>
                {currentBlock.status === 'done' && (
                  <Badge className="bg-success/20 text-success border-success/30">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Completed
                  </Badge>
                )}
              </div>
              <h2 className="text-2xl font-bold text-foreground">{currentBlock.title}</h2>
              <p className="text-muted-foreground">
                {formatTimeFromLocal(currentBlock.start_at)} - {formatTimeFromLocal(currentBlock.end_at)}
              </p>
              {currentBlock.notes && (
                <p className="text-sm text-muted-foreground">{currentBlock.notes}</p>
              )}
            </div>
            
            {/* Completion actions - only show for task blocks */}
            {currentBlock.type === 'task' && (
              !currentBlock.task_id ? (
                <Badge variant="outline" className="text-amber-600 border-amber-600">
                  Not linked - re-run Plan
                </Badge>
              ) : currentBlock.status === 'done' ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleMarkNotDone}
                  disabled={isUpdating}
                >
                  Reopen
                </Button>
              ) : (
                <div className="flex gap-2 items-start">
                  <Input
                    type="number"
                    placeholder="Actual min"
                    value={actualMinutes}
                    onChange={(e) => setActualMinutes(e.target.value)}
                    className="w-28 h-9"
                    min="1"
                  />
                  <Button 
                    size="sm" 
                    className="bg-success hover:bg-success/80"
                    onClick={handleMarkDone}
                    disabled={isUpdating || !actualMinutes}
                  >
                    {isUpdating ? "Saving..." : "Mark Done"}
                  </Button>
                </div>
              )
            )}
          </div>
        </Card>
      )}

      {/* Schedule List */}
      <Card className="glass border-border">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Today's Schedule
          </h3>
          {blocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No schedule yet. Click "Plan My Day" to generate your timeline.
            </div>
          ) : (
            <div className="space-y-3">
              {timelineItems.map((item) => {
                // Handle routine containers
                if ('blocks' in item && item.type === 'routine') {
                  return (
                    <RoutineContainerComponent 
                      key={item.id}
                      routine={item}
                      onBlockClick={handleBlockClick}
                    />
                  );
                }

                // Handle regular blocks
                const block = item as TimeBlock;
                const duration = getBlockDurationFormatted(block.start_at, block.end_at);
                
                return (
                  <Card
                    key={block.id}
                    onClick={() => handleBlockClick(block)}
                    className={`border-l-4 ${getBlockColor(block.type)} hover:bg-card/70 transition-all cursor-pointer`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-foreground">{block.title}</p>
                            {block.status === 'done' && (
                              <Badge className="bg-success/20 text-success border-success/30 h-5">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Done
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatTimeFromLocal(block.start_at)} - {formatTimeFromLocal(block.end_at)}
                            </span>
                            <span>•</span>
                            <span>{duration}</span>
                          </div>
                          {block.notes && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{block.notes}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="capitalize flex-shrink-0">
                          {block.type}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
