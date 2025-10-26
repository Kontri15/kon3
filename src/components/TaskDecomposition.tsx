import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, CheckCircle2, AlertTriangle, Target, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TaskDecompositionProps {
  task: {
    title: string;
    description?: string;
    project?: string;
    dueDate?: string;
  };
}

interface DecompositionResult {
  steps: Array<{
    title: string;
    description: string;
    estimatedMinutes: number;
    dependencies: string[];
  }>;
  artifacts: string[];
  risks: string[];
  checklist: string[];
  mvpPath: string;
  totalEstimatedMinutes: number;
  minBlockMinutes: number;
}

export const TaskDecomposition = ({ task }: TaskDecompositionProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DecompositionResult | null>(null);
  const { toast } = useToast();

  const handleDecompose = async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('decompose-task', {
        body: {
          title: task.title,
          description: task.description,
          context: task.project,
          dueAt: task.dueDate,
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to decompose task');
      }

      setResult(data.decomposition);
      
      toast({
        title: "Task decomposed!",
        description: `${data.decomposition.steps.length} steps identified`,
      });
    } catch (error) {
      console.error('Decomposition error:', error);
      toast({
        title: "Decomposition failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!result) {
    return (
      <Button 
        onClick={handleDecompose} 
        disabled={isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            AI Decompose
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary Card */}
      <Card className="glass border-primary/30 p-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold text-primary">{result.steps.length}</p>
            <p className="text-xs text-muted-foreground">Steps</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-secondary">{result.totalEstimatedMinutes}m</p>
            <p className="text-xs text-muted-foreground">Total Time</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-accent">{result.minBlockMinutes}m</p>
            <p className="text-xs text-muted-foreground">Min Block</p>
          </div>
        </div>
      </Card>

      {/* MVP Path */}
      <Card className="glass border-secondary/30 p-5">
        <div className="flex items-start gap-3">
          <Target className="w-5 h-5 text-secondary mt-1 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-sm mb-1">80/20 MVP Approach</h4>
            <p className="text-sm text-muted-foreground">{result.mvpPath}</p>
          </div>
        </div>
      </Card>

      {/* Steps */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Action Steps
        </h4>
        {result.steps.map((step, index) => (
          <Card key={index} className="glass border-border p-4 hover:border-primary/30 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    Step {index + 1}
                  </Badge>
                  <h5 className="font-medium text-sm">{step.title}</h5>
                </div>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                <Clock className="w-3 h-3" />
                {step.estimatedMinutes}m
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Artifacts */}
      {result.artifacts.length > 0 && (
        <Card className="glass border-border p-4">
          <h4 className="font-semibold text-sm mb-2">Deliverables</h4>
          <ul className="space-y-1">
            {result.artifacts.map((artifact, index) => (
              <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-primary">•</span>
                {artifact}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Risks */}
      {result.risks.length > 0 && (
        <Card className="glass border-warning/30 p-4">
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Potential Risks
          </h4>
          <ul className="space-y-1">
            {result.risks.map((risk, index) => (
              <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-warning">⚠</span>
                {risk}
              </li>
            ))}
          </ul>
        </Card>
      )}


      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setResult(null)}
        className="w-full"
      >
        Decompose Again
      </Button>
    </div>
  );
};
