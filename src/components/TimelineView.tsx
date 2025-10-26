import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";

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

export const TimelineView = () => {
  const hours = Array.from({ length: 24 }, (_, i) => (i + 6) % 24); // 6 AM to 6 AM next day
  const PIXELS_PER_MINUTE = 2; // 120px per hour for better readability
  const TIMELINE_START_HOUR = 6; // 6 AM
  
  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ['blocks', new Date().toDateString()],
    queryFn: async () => {
      const now = new Date();
      // Start at 6 AM today
      const queryStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0);
      // End at 6 AM tomorrow (24 hours later)
      const queryEndTime = new Date(queryStartTime.getTime() + 24 * 60 * 60 * 1000);
      
      // Fetch blocks that START, END, or SPAN across our time window
      // This captures overnight blocks like sleep (22:00 -> 06:00 next day)
      const { data, error } = await supabase
        .from('blocks')
        .select('*')
        .or(`and(start_at.gte.${queryStartTime.toISOString()},start_at.lt.${queryEndTime.toISOString()}),and(end_at.gt.${queryStartTime.toISOString()},end_at.lte.${queryEndTime.toISOString()}),and(start_at.lt.${queryStartTime.toISOString()},end_at.gt.${queryStartTime.toISOString()})`)
        .order('start_at');
      
      if (error) throw error;
      return data as TimeBlock[];
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const formatTimeFromLocal = (isoString: string) => {
    const date = new Date(isoString);
    // Use local time components (JavaScript handles timezone offset automatically)
    return format(date, 'HH:mm');
  };

  const getBlockPosition = (block: TimeBlock) => {
    const start = parseISO(block.start_at);
    const end = parseISO(block.end_at);
    
    // Calculate actual duration from timestamps (ensure minimum 5min for display)
    const actualDurationMinutes = Math.max(
      (end.getTime() - start.getTime()) / 60000,
      5
    );
    
    // Use local time components (timezone offset already in ISO string)
    let startHour = start.getHours();
    let startMinutes = startHour * 60 + start.getMinutes();
    
    // Handle overnight blocks (before 6 AM) - position at end of timeline
    if (startHour < TIMELINE_START_HOUR) {
      startMinutes += 24 * 60; // Add 24 hours to position at bottom
    }
    
    const timelineStartMinutes = TIMELINE_START_HOUR * 60; // 6 AM = 360 minutes
    const timelineEndMinutes = (TIMELINE_START_HOUR + 24) * 60; // 6 AM next day = 1800 minutes
    
    // Calculate top position
    let topPosition = (startMinutes - timelineStartMinutes) * PIXELS_PER_MINUTE;
    
    // For blocks that start before our timeline but end within it
    if (startMinutes < timelineStartMinutes) {
      topPosition = 0; // Start at top of timeline
      const endMinutes = start.getHours() * 60 + start.getMinutes() + actualDurationMinutes;
      const visibleDuration = Math.min(endMinutes - timelineStartMinutes, actualDurationMinutes);
      const height = Math.max(visibleDuration * PIXELS_PER_MINUTE, 40);
      return { top: 0, height };
    }
    
    // Calculate height ensuring it doesn't overflow and has minimum readable height
    const maxHeight = (timelineEndMinutes - startMinutes) * PIXELS_PER_MINUTE;
    const calculatedHeight = actualDurationMinutes * PIXELS_PER_MINUTE;
    const height = Math.max(Math.min(calculatedHeight, maxHeight), 40);
    
    return { top: topPosition, height };
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Current Block Card */}
      {currentBlock && (
        <Card className="glass border-primary/30 p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Badge variant="secondary" className="bg-secondary/20 text-secondary-foreground">
                <Zap className="w-3 h-3 mr-1" />
                Active Now
              </Badge>
              <h2 className="text-2xl font-bold text-foreground">{currentBlock.title}</h2>
              <p className="text-muted-foreground">
                {formatTimeFromLocal(currentBlock.start_at)} - {formatTimeFromLocal(currentBlock.end_at)}
              </p>
              {currentBlock.notes && (
                <p className="text-sm text-muted-foreground">{currentBlock.notes}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Not Done</Button>
              <Button size="sm" className="bg-success hover:bg-success/80">Done</Button>
            </div>
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
            
            {/* Timeline container with blocks */}
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
              
              {/* Blocks */}
              {blocks.map((block) => {
                const { top, height } = getBlockPosition(block);
                return (
                  <Card
                    key={block.id}
                    className={`absolute left-0 right-0 p-3 border-l-4 ${getBlockColor(block.type)} bg-card/50 backdrop-blur hover:bg-card/70 transition-all cursor-pointer`}
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                    }}
                  >
                    <div className="flex items-start justify-between h-full">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{block.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimeFromLocal(block.start_at)} - {formatTimeFromLocal(block.end_at)}
                        </p>
                        {block.notes && height > 60 && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{block.notes}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="capitalize flex-shrink-0 ml-2">
                        {block.type}
                      </Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
