import { Navigation } from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { TrendingUp, Target, Clock, Flame } from "lucide-react";

const Analytics = () => {
  const stats = [
    { label: "Deep Work This Week", value: "18.5h", icon: Clock, change: "+12%" },
    { label: "Ritual Streak", value: "23 days", icon: Flame, change: "Best yet!" },
    { label: "Task Accuracy", value: "87%", icon: Target, change: "+5%" },
    { label: "Weekly Velocity", value: "32 pts", icon: TrendingUp, change: "+8%" },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <Navigation />

        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="glass border-border p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-3xl font-bold">{stat.value}</p>
                      <p className="text-xs text-success">{stat.change}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="glass border-border p-6">
            <h3 className="text-lg font-semibold mb-4">Coming Soon</h3>
            <p className="text-muted-foreground">
              Detailed analytics including velocity by tag, estimate vs. actual comparisons, and ritual tracking will appear here.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
