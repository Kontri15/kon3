import { Navigation } from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const Settings = () => {
  const [searchParams] = useSearchParams();
  const [isWhoopConnected, setIsWhoopConnected] = useState(false);
  const [isCheckingWhoop, setIsCheckingWhoop] = useState(true);

  useEffect(() => {
    checkWhoopConnection();
    
    // Check if redirected back from WHOOP OAuth
    if (searchParams.get('whoop') === 'connected') {
      toast.success('WHOOP connected successfully!');
    }
  }, [searchParams]);

  const checkWhoopConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('oauth_tokens')
        .select('id')
        .eq('user_id', user.id)
        .eq('provider', 'whoop')
        .single();

      setIsWhoopConnected(!!data && !error);
    } catch (error) {
      console.error('Error checking WHOOP connection:', error);
    } finally {
      setIsCheckingWhoop(false);
    }
  };

  const handleWhoopConnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in first');
        return;
      }

      const WHOOP_CLIENT_ID = '487e3de5-cc9a-4a04-9fc4-b89f2d460a49';
      const REDIRECT_URI = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whoop-oauth-callback`;
      
      const authUrl = `https://api.prod.whoop.com/oauth/oauth2/auth?` + 
        `response_type=code&` +
        `client_id=${WHOOP_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=read:recovery read:sleep&` +
        `state=${user.id}`;

      window.location.href = authUrl;
    } catch (error) {
      console.error('Error initiating WHOOP OAuth:', error);
      toast.error('Failed to connect to WHOOP');
    }
  };

  const handleWhoopDisconnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('oauth_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', 'whoop');

      if (error) throw error;

      setIsWhoopConnected(false);
      toast.success('WHOOP disconnected');
    } catch (error) {
      console.error('Error disconnecting WHOOP:', error);
      toast.error('Failed to disconnect WHOOP');
    }
  };

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
                  <p className="text-sm text-muted-foreground">
                    {isWhoopConnected 
                      ? 'Connected - Syncing recovery & sleep data' 
                      : 'Sync recovery & sleep data'}
                  </p>
                </div>
                {isCheckingWhoop ? (
                  <Button variant="outline" disabled>Checking...</Button>
                ) : isWhoopConnected ? (
                  <Button variant="outline" onClick={handleWhoopDisconnect}>Disconnect</Button>
                ) : (
                  <Button variant="outline" onClick={handleWhoopConnect}>Connect</Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
