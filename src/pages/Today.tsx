import { Navigation } from "@/components/Navigation";
import { TimelineView } from "@/components/TimelineView";

const Today = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <Navigation />
        <TimelineView />
      </div>
    </div>
  );
};

export default Today;
