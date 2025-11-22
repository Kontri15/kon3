import { Link, useLocation } from "react-router-dom";
import { Calendar, CheckSquare, Settings, BarChart3, Zap, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ReactNode } from "react";

const navItems = [
  { to: "/", icon: Calendar, label: "Today" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/week", icon: CalendarRange, label: "Week" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

interface NavigationProps {
  children?: ReactNode;
}

export const Navigation = ({ children }: NavigationProps) => {
  const location = useLocation();

  return (
    <nav className="glass border border-border rounded-2xl p-2 mb-6">
      <div className="flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-2 w-[200px]">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">ChronoPilot</h1>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-secondary/20">
              Build Mode
            </Badge>
          </div>
        </div>

        {/* Center: Navigation Links */}
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

        {/* Right: Actions */}
        <div className="flex items-center justify-end gap-2 w-[200px]">
          {children}
        </div>
      </div>
    </nav>
  );
};
