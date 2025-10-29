import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCircle, XCircle } from "lucide-react";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  changes?: any[];
}

interface Props {
  currentBlocks: any[];
  onApplyChanges: (newBlocks: any[]) => void;
}

export const PlanFeedbackChat = ({ currentBlocks, onApplyChanges }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<any[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('refine-plan', {
        body: {
          feedback: input,
          currentBlocks,
          conversationHistory: messages
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.explanation,
        timestamp: new Date(),
        changes: data.modifiedBlocks
      };

      setMessages(prev => [...prev, assistantMessage]);
      setPendingChanges(data.modifiedBlocks);
    } catch (error) {
      console.error('Error refining plan:', error);
      toast({
        title: "Failed to refine plan",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyChanges = () => {
    if (pendingChanges) {
      onApplyChanges(pendingChanges);
      setPendingChanges(null);
      toast({
        title: "Changes applied",
        description: "Your schedule has been updated",
      });
    }
  };

  const handleRejectChanges = () => {
    setPendingChanges(null);
    toast({
      title: "Changes rejected",
      description: "Keeping the current schedule",
    });
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Plan Feedback</h3>
        <Badge variant="secondary">AI Assistant</Badge>
      </div>

      <ScrollArea className="h-[300px] pr-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Ask me to adjust your schedule. For example:<br/>
              "Move lunch to 13:00" or "I need 15 more minutes for workout"
            </p>
          )}
          
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {msg.timestamp.toLocaleTimeString('sk-SK', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {pendingChanges && (
        <div className="flex gap-2 p-3 bg-accent rounded-lg">
          <div className="flex-1">
            <p className="text-sm font-medium">Changes ready to apply</p>
            <p className="text-xs text-muted-foreground">
              {pendingChanges.length} blocks will be modified
            </p>
          </div>
          <Button size="sm" onClick={handleApplyChanges} className="gap-1">
            <CheckCircle className="w-4 h-4" />
            Apply
          </Button>
          <Button size="sm" variant="outline" onClick={handleRejectChanges} className="gap-1">
            <XCircle className="w-4 h-4" />
            Reject
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your feedback..."
          className="resize-none"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button 
          onClick={handleSend} 
          disabled={!input.trim() || isLoading}
          size="icon"
          className="self-end"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </Card>
  );
};
