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
  type: "task" | "ritual" | "event" | "meal" | "break";
  status: string;
  task_id?: string;
  ritual_id?: string;
  notes?: string;
}

export const TimelineView = () => {
  const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 10 PM
  
  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ['blocks', new Date().toDateString()],
    queryFn: async () => {
      const today = new Date();
      const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();
      
      const { data, error } = await supabase
        .from('blocks')
        .select('*')
        .gte('start_at', todayStart)
        .lte('start_at', todayEnd)
        .order('start_at');
      
      if (error) throw error;
      return data as TimeBlock[];
    },
    refetchInterval: 30000, // Refresh every 30s
  });

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
    };
    return colors[type] || colors.task;
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
                {format(parseISO(currentBlock.start_at), 'HH:mm')} - {format(parseISO(currentBlock.end_at), 'HH:mm')}
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
          <div className="space-y-2">
            {hours.map((hour) => {
              const hourStr = hour.toString().padStart(2, '0');
              const blocksAtHour = blocks.filter((block) => {
                const blockHour = format(parseISO(block.start_at), 'HH');
                return blockHour === hourStr;
              });

              return (
                <div key={hour} className="flex gap-4 min-h-[60px]">
                  <div className="w-16 flex-shrink-0">
                    <span className="timeline-hour">
                      {hourStr}:00
                    </span>
                  </div>
                  <div className="flex-1 space-y-2">
                    {blocksAtHour.map((block) => (
                      <Card
                        key={block.id}
                        className={`p-3 border-l-4 ${getBlockColor(block.type)} bg-card/50 backdrop-blur hover:bg-card/70 transition-all cursor-pointer`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{block.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(block.start_at), 'HH:mm')} - {format(parseISO(block.end_at), 'HH:mm')}
                            </p>
                            {block.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{block.notes}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {block.type}
                          </Badge>
                        </div>
                      </Card>
                    ))}
                    {blocksAtHour.length === 0 && (
                      <div className="h-[60px] border-l-2 border-dashed border-border/30" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
