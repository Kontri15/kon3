import { Clock, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TimeBlock {
  id: string;
  title: string;
  start: string;
  end: string;
  type: "task" | "ritual" | "event" | "meal";
  status: "planned" | "active" | "done";
}

const mockBlocks: TimeBlock[] = [
  { id: "1", title: "Deep Work: Build ChronoPilot", start: "06:10", end: "08:00", type: "task", status: "active" },
  { id: "2", title: "Commute to Office", start: "08:00", end: "08:30", type: "event", status: "planned" },
  { id: "3", title: "Team Standup", start: "09:00", end: "09:30", type: "event", status: "planned" },
  { id: "4", title: "Code Review", start: "09:30", end: "11:00", type: "task", status: "planned" },
  { id: "5", title: "Lunch: Salmon & Rice", start: "12:00", end: "12:45", type: "meal", status: "planned" },
  { id: "6", title: "PUSH Day", start: "17:00", end: "18:30", type: "ritual", status: "planned" },
];

export const TimelineView = () => {
  const currentHour = new Date().getHours();
  const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 10 PM

  const getBlockColor = (type: TimeBlock["type"]) => {
    const colors = {
      task: "bg-block-task",
      ritual: "bg-block-ritual",
      event: "bg-block-event",
      meal: "bg-block-meal",
    };
    return colors[type];
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Current Block Card */}
      <Card className="glass border-primary/30 p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="bg-secondary/20 text-secondary-foreground">
              <Zap className="w-3 h-3 mr-1" />
              Active Now
            </Badge>
            <h2 className="text-2xl font-bold text-foreground">Deep Work: Build ChronoPilot</h2>
            <p className="text-muted-foreground">06:10 - 08:00 • 110 minutes</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Not Done</Button>
            <Button size="sm" className="bg-success hover:bg-success/80">Done</Button>
          </div>
        </div>
      </Card>

      {/* Timeline */}
      <Card className="glass border-border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Today's Timeline
        </h3>
        <div className="space-y-2">
          {hours.map((hour) => {
            const blocksAtHour = mockBlocks.filter((block) => {
              const blockHour = parseInt(block.start.split(":")[0]);
              return blockHour === hour;
            });

            return (
              <div key={hour} className="flex gap-4 min-h-[60px]">
                <div className="w-16 flex-shrink-0">
                  <span className={`timeline-hour ${hour === currentHour ? "text-primary font-bold" : ""}`}>
                    {hour.toString().padStart(2, "0")}:00
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
                            {block.start} - {block.end}
                          </p>
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
      </Card>
    </div>
  );
};
