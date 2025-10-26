import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Clock, Calendar, Tag, FileText, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

interface BlockDetailDialogProps {
  block: TimeBlock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (blockId: string) => void;
}

export const BlockDetailDialog = ({ block, open, onOpenChange, onDelete }: BlockDetailDialogProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  if (!block) return null;

  const formatTime = (isoString: string) => {
    return format(parseISO(isoString), 'HH:mm');
  };

  const formatDate = (isoString: string) => {
    return format(parseISO(isoString), 'EEEE, MMMM d, yyyy');
  };

  const getDuration = () => {
    const start = parseISO(block.start_at);
    const end = parseISO(block.end_at);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getTypeColor = (type: TimeBlock["type"]) => {
    const colors = {
      task: "bg-blue-500",
      ritual: "bg-purple-500",
      event: "bg-green-500",
      meal: "bg-orange-500",
      break: "bg-gray-400",
      buffer: "bg-yellow-500",
      commute: "bg-cyan-500",
      sleep: "bg-indigo-500",
    };
    return colors[type] || colors.task;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getTypeColor(block.type)}`} />
            {block.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Time & Duration Node */}
          <Card className="p-4 glass border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Time & Duration</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 ml-7">
              <div>
                <p className="text-sm text-muted-foreground">Start Time</p>
                <p className="text-lg font-medium">{formatTime(block.start_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">End Time</p>
                <p className="text-lg font-medium">{formatTime(block.end_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-lg font-medium">{getDuration()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="text-sm font-medium">{formatDate(block.start_at)}</p>
              </div>
            </div>
          </Card>

          {/* Type & Status Node */}
          <Card className="p-4 glass border-secondary/20">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-5 h-5 text-secondary" />
              <h3 className="font-semibold">Classification</h3>
            </div>
            <div className="flex gap-4 ml-7">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Type</p>
                <Badge variant="outline" className="capitalize">
                  {block.type}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Status</p>
                <Badge 
                  variant={block.status === 'completed' ? 'default' : 'secondary'}
                  className="capitalize"
                >
                  {block.status}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Notes Node */}
          {block.notes && (
            <Card className="p-4 glass border-accent/20">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-accent" />
                <h3 className="font-semibold">Notes</h3>
              </div>
              <p className="ml-7 text-muted-foreground">{block.notes}</p>
            </Card>
          )}

          {/* Related Items Node */}
          {(block.task_id || block.ritual_id) && (
            <Card className="p-4 glass border-muted/20">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-semibold">Related Items</h3>
              </div>
              <div className="ml-7 space-y-2">
                {block.task_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Task ID: {block.task_id}</span>
                  </div>
                )}
                {block.ritual_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Ritual ID: {block.ritual_id}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-between pt-4 border-t">
            <Button 
              variant="destructive" 
              className="gap-2"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4" />
              Delete Block
            </Button>
            <Button 
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this block?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove "{block.title}" from your schedule.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onDelete(block.id);
                  setShowDeleteDialog(false);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};
