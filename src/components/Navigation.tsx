import { Link, useLocation } from "react-router-dom";
import { Calendar, CheckSquare, Settings, BarChart3, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { to: "/", icon: Calendar, label: "Today" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export const Navigation = () => {
  const location = useLocation();

  return (
    <nav className="glass border border-border rounded-2xl p-2 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">ChronoPilot</h1>
            <Badge variant="secondary" className="text-xs bg-secondary/20">
              Build Mode
            </Badge>
          </div>
        </div>

        <div className="flex gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-surface-elevated text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
