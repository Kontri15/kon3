import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface TimeBlock {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  type: string;
  status?: string;
}

interface RoutineContainer {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  blocks: TimeBlock[];
  type: 'routine';
}

interface Props {
  routine: RoutineContainer;
  onBlockClick?: (block: TimeBlock) => void;
}

export const RoutineContainerComponent = ({ routine, onBlockClick }: Props) => {
  const [expanded, setExpanded] = useState(false);

  const formatTime = (isoTime: string) => {
    return new Date(isoTime).toLocaleTimeString('sk-SK', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const getBlockDuration = (block: TimeBlock) => {
    const start = new Date(block.start_at);
    const end = new Date(block.end_at);
    return Math.round((end.getTime() - start.getTime()) / 60000);
  };

  const totalDuration = routine.blocks.reduce((acc, block) => acc + getBlockDuration(block), 0);

  return (
    <Card className="p-4 hover:shadow-md transition-shadow border-l-4 border-l-primary/50">
      <div 
        className="flex justify-between items-center cursor-pointer" 
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <div>
            <p className="font-semibold text-foreground">{routine.title}</p>
            <p className="text-xs text-muted-foreground">
              {formatTime(routine.start_at)} - {formatTime(routine.end_at)} ({totalDuration} min)
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          {routine.blocks.length} activities
        </Badge>
      </div>
      
      {expanded && (
        <div className="mt-3 space-y-2 pl-6 border-l-2 border-border">
          {routine.blocks.map(block => (
            <div 
              key={block.id}
              onClick={(e) => {
                e.stopPropagation();
                onBlockClick?.(block);
              }}
              className="p-2 rounded hover:bg-accent cursor-pointer transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{block.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(block.start_at)} - {formatTime(block.end_at)} 
                    <span className="ml-2">({getBlockDuration(block)} min)</span>
                  </p>
                </div>
                {block.status === 'done' && (
                  <Badge variant="default" className="text-xs ml-2">Done</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
