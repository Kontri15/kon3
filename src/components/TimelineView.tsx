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
        .select('*')
        .gte('start_at', queryStartTime)
        .lt('start_at', queryEndTime)
        .order('start_at');
        
      if (error) throw error;
      return data as TimeBlock[];
    },
    refetchInterval: 30000,
  });

  const formatTimeFromLocal = (isoString: string) => {
    const date = new Date(isoString);
    // Use local time components (JavaScript handles timezone offset automatically)
    return format(date, 'HH:mm');
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
    
    // Calculate height (minimum 40px for visibility)
    const height = Math.max(visibleDurationMinutes * PIXELS_PER_MINUTE, 40);
    
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
