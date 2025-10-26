import { Navigation } from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Settings = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <Navigation />

        <div className="space-y-6 animate-fade-in">
          <Card className="glass border-border p-6">
            <h3 className="text-xl font-semibold mb-6">Profile Settings</h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="build-mode" className="text-base">Build Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Prioritize deep work from 06:10-08:00 every day
                  </p>
                </div>
                <Switch id="build-mode" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="friday-home" className="text-base">Friday Home Office</Label>
                  <p className="text-sm text-muted-foreground">
                    Work from home on Fridays
                  </p>
                </div>
                <Switch id="friday-home" defaultChecked />
              </div>

              <div className="space-y-2">
                <Label className="text-base">Location</Label>
                <div className="flex gap-2">
                  <Badge variant="default" className="cursor-pointer">BA</Badge>
                  <Badge variant="outline" className="cursor-pointer">SNV</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card className="glass border-border p-6">
            <h3 className="text-xl font-semibold mb-6">Integrations</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-surface border border-border">
                <div className="space-y-1">
                  <p className="font-medium">Microsoft Outlook</p>
                  <p className="text-sm text-muted-foreground">Sync calendar events</p>
                </div>
                <Button variant="outline">Connect</Button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-surface border border-border">
                <div className="space-y-1">
                  <p className="font-medium">WHOOP</p>
                  <p className="text-sm text-muted-foreground">Sync recovery & sleep data</p>
                </div>
                <Button variant="outline">Connect</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
