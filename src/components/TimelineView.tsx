import { Card } from "@/components/ui/card";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

interface DragState {
  blockId: string;
  startY: number;
  originalStartAt: string;
  originalEndAt: string;
}

interface ResizeState {
  blockId: string;
  startY: number;
  originalEndAt: string;
  edge: 'top' | 'bottom';
}

export const TimelineView = () => {
  const [selectedBlock, setSelectedBlock] = useState<TimeBlock | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actualMinutes, setActualMinutes] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);
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
      
      // Check if next block is consecutive and also micro
      const nextBlock = sortedBlocks[index + 1];
      const isNextConsecutive = nextBlock && 
        new Date(nextBlock.start_at).getTime() === new Date(block.end_at).getTime();
      const isNextMicro = nextBlock && getBlockDuration(nextBlock) < 15;
      
      if (duration < 15 && (isNextConsecutive && isNextMicro)) {
        if (currentGroup.length === 0) groupStart = block.start_at;
        currentGroup.push(block);
      } else if (duration < 15 && currentGroup.length > 0) {
        // Last micro block in a group
        currentGroup.push(block);
        
        if (currentGroup.length >= 3) {
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
        // Flush current group if exists
        if (currentGroup.length >= 3) {
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
        
        grouped.push(block);
        currentGroup = [];
        groupStart = null;
      }
      
      // Handle last block edge case
      if (isLastBlock && currentGroup.length > 0) {
        if (currentGroup.length >= 3) {
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
  const blocks = rawBlocks; // Keep original blocks for compatibility with existing logic

  const formatTimeFromLocal = (isoString: string) => {
    const date = new Date(isoString);
    // Use local time components (JavaScript handles timezone offset automatically)
    return format(date, 'HH:mm');
  };

  const getBlockStyling = (durationMinutes: number) => {
    if (durationMinutes < 15) {
      // Micro blocks: < 15 minutes
      return {
        minHeight: 20,
        titleSize: "text-[10px]",
        timeSize: "text-[9px]",
        showTime: false,
        showBadge: false,
        showNotes: false,
        zIndex: 90 + Math.floor(15 - durationMinutes), // Higher z-index for shorter blocks
      };
    } else if (durationMinutes < 30) {
      // Short blocks: 15-30 minutes
      return {
        minHeight: 30,
        titleSize: "text-xs",
        timeSize: "text-[10px]",
        showTime: true,
        showBadge: false,
        showNotes: false,
        zIndex: 80 + Math.floor(30 - durationMinutes),
      };
    } else if (durationMinutes < 60) {
      // Medium blocks: 30-60 minutes
      return {
        minHeight: 40,
        titleSize: "text-sm",
        timeSize: "text-xs",
        showTime: true,
        showBadge: true,
        showNotes: false,
        zIndex: 70,
      };
    } else {
      // Full blocks: > 60 minutes
      return {
        minHeight: 40,
        titleSize: "text-sm",
        timeSize: "text-xs",
        showTime: true,
        showBadge: true,
        showNotes: true,
        zIndex: 60,
      };
    }
  };

  const getBlockPosition = (block: TimeBlock) => {
    const start = parseISO(block.start_at);
    const end = parseISO(block.end_at);
    
    // Get local hours/minutes from the timestamp
    const startHour = start.getHours();
    const startMinute = start.getMinutes();
    const endHour = end.getHours();
    const endMinute = end.getMinutes();
    
    // Calculate minutes from midnight
    let startMinutesFromMidnight = startHour * 60 + startMinute;
    let endMinutesFromMidnight = endHour * 60 + endMinute;
    
    // Handle overnight blocks (end time is next day)
    if (endMinutesFromMidnight < startMinutesFromMidnight) {
      endMinutesFromMidnight += 24 * 60;
    }
    
    // Timeline starts at 6 AM (360 minutes from midnight)
    const timelineStartMinutes = TIMELINE_START_HOUR * 60;
    const timelineEndMinutes = timelineStartMinutes + (24 * 60); // +24 hours
    
    // Clamp block to visible timeline
    const visibleStartMinutes = Math.max(startMinutesFromMidnight, timelineStartMinutes);
    const visibleEndMinutes = Math.min(endMinutesFromMidnight, timelineEndMinutes);
    
    // Calculate visible duration (minimum 5 minutes)
    const visibleDurationMinutes = Math.max(visibleEndMinutes - visibleStartMinutes, 5);
    
    // Calculate top position (relative to timeline start)
    const topPosition = (visibleStartMinutes - timelineStartMinutes) * PIXELS_PER_MINUTE;
    
    // Get styling config
    const styling = getBlockStyling(visibleDurationMinutes);
    
    // Calculate height (use actual duration but respect minimum from styling)
    const height = Math.max(visibleDurationMinutes * PIXELS_PER_MINUTE, styling.minHeight);
    
    return { top: topPosition, height, styling };
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

  const getTimeOfDayBackground = (hour: number) => {
    if (hour >= 6 && hour < 12) return "bg-blue-500/5"; // Morning
    if (hour >= 12 && hour < 18) return "bg-background"; // Afternoon
    if (hour >= 18 && hour < 22) return "bg-orange-500/5"; // Evening
    return "bg-slate-500/5"; // Night/Early morning
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

  const handleDragStart = (e: React.MouseEvent, block: TimeBlock) => {
    e.stopPropagation();
    setDragState({
      blockId: block.id,
      startY: e.clientY,
      originalStartAt: block.start_at,
      originalEndAt: block.end_at
    });
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!dragState) return;

    const deltaY = e.clientY - dragState.startY;
    const deltaMinutes = Math.round(deltaY / PIXELS_PER_MINUTE);

    if (Math.abs(deltaMinutes) < 1) return;

    const originalStart = parseISO(dragState.originalStartAt);
    const originalEnd = parseISO(dragState.originalEndAt);
    
    const newStart = new Date(originalStart.getTime() + deltaMinutes * 60 * 1000);
    const newEnd = new Date(originalEnd.getTime() + deltaMinutes * 60 * 1000);

    // Update block optimistically
    queryClient.setQueryData(['blocks', new Date().toDateString()], (old: TimeBlock[] | undefined) => {
      if (!old) return old;
      return old.map(b => 
        b.id === dragState.blockId 
          ? { ...b, start_at: newStart.toISOString(), end_at: newEnd.toISOString() }
          : b
      );
    });
  };

  const handleDragEnd = async () => {
    if (!dragState) return;

    const block = blocks.find(b => b.id === dragState.blockId);
    if (!block) return;

    try {
      const { error } = await supabase
        .from('blocks')
        .update({
          start_at: block.start_at,
          end_at: block.end_at
        })
        .eq('id', block.id);

      if (error) throw error;

      toast({
        title: "Block moved",
        description: "Schedule updated successfully"
      });

      queryClient.invalidateQueries({ queryKey: ['blocks'] });
    } catch (error) {
      console.error('Error updating block:', error);
      toast({
        title: "Failed to move block",
        description: "Reverting changes",
        variant: "destructive"
      });
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
    } finally {
      setDragState(null);
    }
  };

  const handleResizeStart = (e: React.MouseEvent, block: TimeBlock, edge: 'top' | 'bottom') => {
    e.stopPropagation();
    setResizeState({
      blockId: block.id,
      startY: e.clientY,
      originalEndAt: edge === 'bottom' ? block.end_at : block.start_at,
      edge
    });
  };

  const handleResizeMove = (e: React.MouseEvent) => {
    if (!resizeState) return;

    const deltaY = e.clientY - resizeState.startY;
    const deltaMinutes = Math.round(deltaY / PIXELS_PER_MINUTE);

    if (Math.abs(deltaMinutes) < 1) return;

    const originalTime = parseISO(resizeState.originalEndAt);
    const newTime = new Date(originalTime.getTime() + deltaMinutes * 60 * 1000);

    queryClient.setQueryData(['blocks', new Date().toDateString()], (old: TimeBlock[] | undefined) => {
      if (!old) return old;
      return old.map(b => {
        if (b.id === resizeState.blockId) {
          if (resizeState.edge === 'bottom') {
            return { ...b, end_at: newTime.toISOString() };
          } else {
            return { ...b, start_at: newTime.toISOString() };
          }
        }
        return b;
      });
    });
  };

  const handleResizeEnd = async () => {
    if (!resizeState) return;

    const block = blocks.find(b => b.id === resizeState.blockId);
    if (!block) return;

    // Validate minimum duration (5 minutes)
    const start = parseISO(block.start_at);
    const end = parseISO(block.end_at);
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

    if (durationMinutes < 5) {
      toast({
        title: "Invalid duration",
        description: "Blocks must be at least 5 minutes long",
        variant: "destructive"
      });
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      setResizeState(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('blocks')
        .update({
          start_at: block.start_at,
          end_at: block.end_at
        })
        .eq('id', block.id);

      if (error) throw error;

      toast({
        title: "Block resized",
        description: "Duration updated successfully"
      });

      queryClient.invalidateQueries({ queryKey: ['blocks'] });
    } catch (error) {
      console.error('Error resizing block:', error);
      toast({
        title: "Failed to resize block",
        description: "Reverting changes",
        variant: "destructive"
      });
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
    } finally {
      setResizeState(null);
    }
  };

  return (
    <TooltipProvider>
      <div 
        className="space-y-6 animate-fade-in"
        onMouseMove={(e) => {
          if (dragState) handleDragMove(e);
          if (resizeState) handleResizeMove(e);
        }}
        onMouseUp={() => {
          if (dragState) handleDragEnd();
          if (resizeState) handleResizeEnd();
        }}
        onMouseLeave={() => {
          if (dragState) handleDragEnd();
          if (resizeState) handleResizeEnd();
        }}
      >
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

      {/* Timeline */}
      <Card className="glass border-border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Today's Timeline
        </h3>
        {blocks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No schedule yet. Click "Plan My Day" to generate your timeline.
          </div>
        ) : (
          <div className="flex gap-4">
            {/* Hour markers */}
            <div className="w-16 flex-shrink-0 relative" style={{ height: `${24 * 60 * PIXELS_PER_MINUTE}px` }}>
              {hours.map((hour, index) => (
                <div
                  key={hour}
                  className="absolute w-full text-right pr-3 text-sm font-medium text-muted-foreground"
                  style={{ top: `${index * 60 * PIXELS_PER_MINUTE}px` }}
                >
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>
            
            {/* Timeline container with items (blocks or routine containers) */}
            <div className="flex-1 relative border-l border-border" style={{ height: `${24 * 60 * PIXELS_PER_MINUTE}px` }}>
              {/* Time-of-day background sections */}
              {hours.map((hour, index) => (
                <div
                  key={`bg-${hour}`}
                  className={`absolute w-full ${getTimeOfDayBackground(hour)}`}
                  style={{ 
                    top: `${index * 60 * PIXELS_PER_MINUTE}px`,
                    height: `${60 * PIXELS_PER_MINUTE}px`
                  }}
                />
              ))}
              
              {/* Hour grid lines */}
              {hours.map((hour, index) => (
                <div
                  key={`line-${hour}`}
                  className="absolute left-0 right-0 border-t border-border"
                  style={{ top: `${index * 60 * PIXELS_PER_MINUTE}px` }}
                />
              ))}
              
              {/* Half-hour lines */}
              {hours.map((hour, index) => (
                <div
                  key={`half-${hour}`}
                  className="absolute left-0 right-0 border-t border-border/30"
                  style={{ top: `${(index * 60 + 30) * PIXELS_PER_MINUTE}px` }}
                />
              ))}
              
              {/* Blocks and Routine Containers */}
              {timelineItems.map((item) => {
                // Handle routine containers
                if ('blocks' in item && item.type === 'routine') {
                  const { top, height, styling } = getBlockPosition({
                    ...item.blocks[0],
                    start_at: item.start_at,
                    end_at: item.end_at
                  });

                  return (
                    <div
                      key={item.id}
                      className="absolute left-0 right-0"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        zIndex: 20,
                        padding: '0 4px'
                      }}
                    >
                      <RoutineContainerComponent 
                        routine={item}
                        onBlockClick={handleBlockClick}
                      />
                    </div>
                  );
                }

                // Handle regular blocks
                const block = item as TimeBlock;
                const { top, height, styling } = getBlockPosition(block);
                const duration = getBlockDuration(block);
                const isHovered = hoveredBlock === block.id;
                const isDragging = dragState?.blockId === block.id;
                const isResizing = resizeState?.blockId === block.id;
                
                const blockContent = (
                  <Card
                    key={block.id}
                    onMouseEnter={() => setHoveredBlock(block.id)}
                    onMouseLeave={() => setHoveredBlock(null)}
                    onClick={() => !isDragging && !isResizing && handleBlockClick(block)}
                    className={`absolute left-0 right-0 border-l-4 ${getBlockColor(block.type)} bg-card/50 backdrop-blur hover:bg-card/70 transition-all cursor-pointer overflow-hidden group ${
                      isDragging || isResizing ? 'opacity-70 shadow-xl scale-105' : ''
                    } ${isHovered ? 'shadow-lg scale-[1.01] z-50' : ''}`}
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      zIndex: isDragging || isResizing ? 100 : isHovered ? 90 : styling.zIndex,
                      padding: duration < 15 ? '4px 8px' : '12px',
                    }}
                  >
                    {/* Top resize handle */}
                    {isHovered && duration >= 15 && (
                      <div
                        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize bg-primary/20 hover:bg-primary/40 transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, block, 'top')}
                      />
                    )}
                    
                    {/* Drag handle */}
                    <div
                      className={`flex items-start justify-between h-full gap-2 ${
                        isHovered && duration >= 15 ? 'cursor-move' : ''
                      }`}
                      onMouseDown={(e) => duration >= 15 && handleDragStart(e, block)}
                    >
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className={`font-medium ${styling.titleSize} truncate leading-tight`}>
                          {block.title}
                        </p>
                        {styling.showTime && (
                          <p className={`${styling.timeSize} text-muted-foreground mt-0.5`}>
                            {formatTimeFromLocal(block.start_at)} - {formatTimeFromLocal(block.end_at)}
                          </p>
                        )}
                        {styling.showNotes && block.notes && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{block.notes}</p>
                        )}
                      </div>
                      {styling.showBadge && (
                        <Badge variant="outline" className="capitalize flex-shrink-0 text-[10px] h-5">
                          {block.type}
                        </Badge>
                      )}
                      {!styling.showBadge && duration < 15 && (
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary/40" />
                      )}
                    </div>

                    {/* Bottom resize handle */}
                    {isHovered && duration >= 15 && (
                      <div
                        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-primary/20 hover:bg-primary/40 transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, block, 'bottom')}
                      />
                    )}
                  </Card>
                );
                
                // Wrap very short blocks in a tooltip
                if (duration < 30) {
                  return (
                    <Tooltip key={block.id}>
                      <TooltipTrigger asChild>
                        {blockContent}
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-1">
                          <p className="font-semibold">{block.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeFromLocal(block.start_at)} - {formatTimeFromLocal(block.end_at)}
                          </p>
                          <Badge variant="outline" className="capitalize text-xs">
                            {block.type}
                          </Badge>
                          {block.notes && (
                            <p className="text-xs mt-2">{block.notes}</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                
                return blockContent;
              })}
            </div>
          </div>
        )}
      </Card>
      </div>
    </TooltipProvider>
  );
};
