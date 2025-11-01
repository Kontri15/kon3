import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { weekStart, weekEnd } = await req.json();
    console.log("Planning week:", weekStart, "to", weekEnd);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .single();

    // Fetch tasks due this week
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'todo')
      .gte('due_at', weekStart)
      .lte('due_at', weekEnd)
      .order('priority', { ascending: false });

    // Fetch existing events
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .gte('start_at', weekStart)
      .lte('end_at', weekEnd);

    // Fetch rituals
    const { data: rituals } = await supabase
      .from('rituals')
      .select('*');

    // Use Lovable AI to generate week plan
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `You are a personal productivity AI that creates weekly schedules.
Generate a complete week schedule from ${weekStart} to ${weekEnd}.

User profile:
- Work hours: ${profile?.work_arrival || '08:30'} to ${profile?.work_leave || '16:30'}
- Bedtime: ${profile?.bedtime || '22:00'}
- Home city: ${profile?.home_city || 'BA'}

Tasks to schedule:
${JSON.stringify(tasks || [], null, 2)}

Existing events:
${JSON.stringify(events || [], null, 2)}

Regular rituals:
${JSON.stringify(rituals || [], null, 2)}

Create a balanced week schedule with:
1. All tasks scheduled based on priority and deadlines
2. Regular rituals at consistent times
3. Work blocks, breaks, meals, and sleep
4. Buffer time between activities
5. Respect existing events as fixed blocks

Return ONLY a JSON array of blocks with this exact structure:
[
  {
    "title": "Block title",
    "type": "task|ritual|meal|break|buffer|sleep",
    "start_at": "YYYY-MM-DDTHH:mm:ss",
    "end_at": "YYYY-MM-DDTHH:mm:ss",
    "task_id": "uuid or null",
    "ritual_id": "uuid or null",
    "notes": "any notes"
  }
]`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate the week schedule." }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      throw new Error(`AI generation failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in AI response");
    }

    const blocks = JSON.parse(jsonMatch[0]);
    console.log(`Generated ${blocks.length} blocks for the week`);

    // Insert blocks into database
    const { error: insertError } = await supabase
      .from('blocks')
      .insert(blocks.map((block: any) => ({
        ...block,
        user_id: "00000000-0000-0000-0000-000000000001",
        status: "planned",
      })));

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, blocksCreated: blocks.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in plan-my-week:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
