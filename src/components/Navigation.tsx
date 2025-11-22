import { Link, useLocation } from "react-router-dom";
import { Calendar, CheckSquare, Settings, BarChart3, Zap, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();

  return (
    <nav className="glass border border-border rounded-2xl p-2 mb-6">
      <div className="flex items-center justify-between gap-2 md:gap-4">
        {/* Left: Logo */}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 md:w-5 md:h-5 text-primary-foreground" />
          </div>
          <h1 className="font-bold text-base md:text-lg leading-none">ChronoPilot</h1>
        </div>

        {/* Center: Navigation Links - Hidden on mobile */}
        {!isMobile && (
          <div className="flex gap-1 flex-1 justify-center">
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
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-1 md:gap-2 ml-auto">
          {children}
        </div>
      </div>
    </nav>
  );
};
