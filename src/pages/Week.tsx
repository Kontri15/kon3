import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlockCreateDialog } from "@/components/BlockCreateDialog";
import { BlockDetailDialog } from "@/components/BlockDetailDialog";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Zap } from "lucide-react";
import { format, addDays, isSameDay, startOfWeek } from "date-fns";
import { getWeekBounds, formatDateRange, getWeekDays, canGoBackward, canGoForward } from "@/lib/dateUtils";
import { useBlocksForDateRange } from "@/hooks/useBlocksForDateRange";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function Week() {
  const today = new Date();
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(today, { weekStartsOn: 1 }));
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isPlanning, setIsPlanning] = useState(false);
  const [weekType, setWeekType] = useState<"Quantity" | "Intensity" | "Mixed">("Mixed");
  const queryClient = useQueryClient();

  const { start: weekStart, end: weekEnd } = getWeekBounds(currentWeekStart);
  const weekDays = getWeekDays(weekStart);
  
  const { data: blocks = [], isLoading } = useBlocksForDateRange(weekStart, weekEnd);

  const goToPreviousWeek = () => {
    const newWeekStart = addDays(currentWeekStart, -7);
    if (canGoBackward(currentWeekStart)) {
      setCurrentWeekStart(newWeekStart);
    }
  };

  const goToNextWeek = () => {
    const newWeekStart = addDays(currentWeekStart, 7);
    if (canGoForward(currentWeekStart)) {
      setCurrentWeekStart(newWeekStart);
    }
  };

  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
  };

  const handlePlanWeek = async () => {
    setIsPlanning(true);
    try {
      const { error } = await supabase.functions.invoke("plan-my-week", {
        body: {
          weekStartIso: weekStart.toISOString(),
          weekType,
          wakeTime: "06:00",
          buildModeStart: "06:15",
          buildModeEnd: "08:00",
        },
      });

      if (error) throw error;

      toast.success(`Week planned successfully (${weekType} mode)!`);
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    } catch (error) {
      console.error("Error planning week:", error);
      toast.error("Failed to plan week");
    } finally {
      setIsPlanning(false);
    }
  };

  const getBlocksForDay = (day: Date) => {
    return blocks.filter((block) => {
      const blockDate = new Date(block.start_at);
      return isSameDay(blockDate, day);
    });
  };

  const getBlockColor = (type: string) => {
    const colors: Record<string, string> = {
      task: "bg-primary/10 border-primary/20 hover:border-primary/40",
      ritual: "bg-secondary/10 border-secondary/20 hover:border-secondary/40",
      event: "bg-accent/10 border-accent/20 hover:border-accent/40",
      meal: "bg-green-500/10 border-green-500/20 hover:border-green-500/40",
      break: "bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40",
      buffer: "bg-yellow-500/10 border-yellow-500/20 hover:border-yellow-500/40",
      commute: "bg-purple-500/10 border-purple-500/20 hover:border-purple-500/40",
      sleep: "bg-indigo-500/10 border-indigo-500/20 hover:border-indigo-500/40",
    };
    return colors[type] || "bg-muted border-border hover:border-muted-foreground/40";
  };

  const handleDeleteBlock = async (blockId: string) => {
    try {
      const { error } = await supabase
        .from("blocks")
        .delete()
        .eq("id", blockId);

      if (error) throw error;

      toast.success("Block deleted");
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
      setSelectedBlockId(null);
    } catch (error) {
      console.error("Error deleting block:", error);
      toast.error("Failed to delete block");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Navigation />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Weekly View</h1>
              <p className="text-muted-foreground">{formatDateRange(weekStart, weekEnd)}</p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousWeek}
                disabled={!canGoBackward(currentWeekStart)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={goToToday}>
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextWeek}
                disabled={!canGoForward(currentWeekStart)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex gap-2">
              <Select value={weekType} onValueChange={(value: any) => setWeekType(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Quantity">Quantity</SelectItem>
                  <SelectItem value="Intensity">Intensity</SelectItem>
                  <SelectItem value="Mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handlePlanWeek} disabled={isPlanning}>
                <Zap className="w-4 h-4 mr-2" />
                {isPlanning ? "Planning..." : "Plan Week"}
              </Button>
            </div>
            <Button variant="outline" onClick={() => {
              setSelectedDate(undefined);
              setCreateDialogOpen(true);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Block
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
            {weekDays.map((day) => {
              const dayBlocks = getBlocksForDay(day);
              const isToday = isSameDay(day, today);

              return (
                <Card
                  key={day.toISOString()}
                  className={isToday ? "border-primary shadow-lg" : ""}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">
                          {format(day, "EEE")}
                        </span>
                        <span className="text-lg font-bold">
                          {format(day, "d")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {dayBlocks.length}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => {
                            setSelectedDate(day);
                            setCreateDialogOpen(true);
                          }}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dayBlocks.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No blocks
                      </p>
                    ) : (
                      dayBlocks.map((block) => (
                        <div
                          key={block.id}
                          className={`p-2 rounded border cursor-pointer transition-all ${getBlockColor(block.type)}`}
                          onClick={() => setSelectedBlockId(block.id)}
                        >
                          <div className="text-xs font-medium truncate">
                            {block.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(block.start_at), "HH:mm")} -{" "}
                            {format(new Date(block.end_at), "HH:mm")}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <BlockCreateDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          defaultDate={selectedDate}
        />

        {selectedBlockId && (
          <BlockDetailDialog
            open={!!selectedBlockId}
            onOpenChange={(open) => !open && setSelectedBlockId(null)}
            block={blocks.find(b => b.id === selectedBlockId)!}
            onDelete={handleDeleteBlock}
          />
        )}
      </div>
    </div>
  );
}
