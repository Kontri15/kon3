import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Task {
  id: string;
  title: string;
  description?: string;
  est_min?: number;
  priority: number;
  impact: number;
  due_at?: string;
  tags?: string[];
  project?: string;
  energy_need: number;
  min_block_min: number;
  location?: string;
  earliest_start?: string;
  hard_window_start?: string;
  hard_window_end?: string;
}

interface Ritual {
  id: string;
  name: string;
  duration_min: number;
  preferred_start?: string;
  preferred_end?: string;
  hard_fixed: boolean;
  days_of_week?: string[];
  location?: string;
  pre_buffer_min: number;
  post_buffer_min: number;
}

interface Event {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  hard_fixed: boolean;
}

interface Profile {
  build_mode: boolean;
  home_city: string;
  work_arrival?: string;
  work_leave?: string;
  friday_home_office: boolean;
  bedtime?: string;
  prebed_start?: string;
}

interface WhoopData {
  recovery_pct?: number;
  hrv_ms?: number;
  rhr_bpm?: number;
  sleep_perf_pct?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role key for single-user app (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Single-user mode: use static user ID
    const userId = '00000000-0000-0000-0000-000000000001';
    console.log('Planning day (single-user mode)');

    // Fetch all required data (all optional - will work with empty DB)
    const [tasksRes, ritualsRes, eventsRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('status', 'todo'),
      supabase.from('rituals').select('*'),
      supabase.from('events').select('*').gte('start_at', new Date().toISOString())
    ]);

    const tasks: Task[] = tasksRes.data || [];
    const rituals: Ritual[] = ritualsRes.data || [];
    const events: Event[] = eventsRes.data || [];
    
    // Use sensible defaults for profile
    const profile: Profile = {
      build_mode: true,
      home_city: 'BA',
      work_arrival: '08:30:00',
      work_leave: '16:30:00',
      friday_home_office: true,
      bedtime: '22:00:00',
      prebed_start: '21:30:00'
    };
    
    const whoop: WhoopData = {};

    console.log(`Loaded: ${tasks.length} tasks, ${rituals.length} rituals, ${events.length} events`);
    
    // If no data exists, AI will create a balanced template day
    if (tasks.length === 0 && rituals.length === 0 && events.length === 0) {
      console.log('No tasks/rituals/events found - will generate template schedule');
    }

    // Build AI prompt
    const today = new Date();
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
    const isWorkday = today.getDay() >= 1 && today.getDay() <= 5;
    const isFriday = today.getDay() === 5;

    const systemPrompt = `You are ChronoPilot's scheduling engine. Plan a day from 06:00-22:00 for ${today.toISOString().split('T')[0]} (${dayOfWeek}).

HARD CONSTRAINTS:
- Deep work block: 06:10-08:00 (build_mode=${profile.build_mode} → ${profile.build_mode ? 'SACRED, never move' : 'flexible'})
- Office hours: ${isWorkday ? `arrive ${profile.work_arrival}, leave ${profile.work_leave}` : 'no office'} ${isFriday ? '(Friday = home office)' : ''}
- Bedtime routine: starts ${profile.prebed_start}, sleep by ${profile.bedtime}
- All hard-fixed events MUST be scheduled exactly as given
- Respect min_block_min for tasks (don't fragment)
- Add buffers for hard-fixed events (pre_buffer_min/post_buffer_min)

SCHEDULING RULES:
1. Pack hard-fixed events first (events + rituals with hard_fixed=true)
2. Heaviest cognitive tasks during deep work (06:10-08:00)
3. Score tasks: (impact * 3) + (priority * 2) + (urgency_score) - (energy_mismatch_penalty)
4. Cluster by tags/projects (minimize context switching)
5. Breaks: use "buffer" type for 5-10min rest periods every 50-90min of focused work
6. Meals: use "meal" type for breakfast/lunch/dinner
7. Sleep: use "sleep" type for bedtime routine and actual sleep
8. Day buffer: leave 10-15% unscheduled
9. If WHOOP recovery <40%, prioritize active recovery over intense work
10. Respect location constraints (home vs office vs any)
11. Honor earliest_start, hard_window_start, hard_window_end if present

WHOOP DATA TODAY:
- Recovery: ${whoop.recovery_pct || 'N/A'}%
- HRV: ${whoop.hrv_ms || 'N/A'}ms
- RHR: ${whoop.rhr_bpm || 'N/A'}bpm

OUTPUT FORMAT:
Return ONLY a JSON array of blocks (no markdown, no explanation):
[
  {
    "title": "Block title",
    "start_at": "2025-10-26T06:10:00Z",
    "end_at": "2025-10-26T08:00:00Z",
    "type": "task" | "ritual" | "event" | "meal" | "sleep" | "buffer" | "commute",
    "status": "planned",
    "task_id": "uuid or null",
    "ritual_id": "uuid or null",
    "notes": "Optional context"
  }
]

Use ISO 8601 timestamps. Ensure no overlaps. Fill the entire day 06:00-22:00.`;

    const userPrompt = `
TASKS (${tasks.length}):
${tasks.length > 0 ? tasks.map(t => `- "${t.title}" [${t.est_min || 60}min, priority=${t.priority}, impact=${t.impact}, energy=${t.energy_need}, tags=${t.tags?.join(',') || 'none'}] ${t.due_at ? `DUE: ${t.due_at}` : ''}`).join('\n') : '(No tasks - create a balanced day with deep work, breaks, meals, and personal time)'}

RITUALS (${rituals.length}):
${rituals.length > 0 ? rituals.map(r => `- "${r.name}" [${r.duration_min}min, ${r.hard_fixed ? 'HARD-FIXED' : 'flexible'}, preferred=${r.preferred_start || 'any'}, days=${r.days_of_week?.join(',') || 'all'}]`).join('\n') : '(No rituals - suggest standard morning routine, exercise, meals, and wind-down)'}

EVENTS (${events.length}):
${events.length > 0 ? events.map(e => `- "${e.title}" [${e.start_at} to ${e.end_at}, ${e.hard_fixed ? 'HARD-FIXED' : 'flexible'}]`).join('\n') : '(No events)'}

Generate optimal schedule as JSON array. If no tasks/rituals exist, create a productive template day with:
- Deep work block (06:10-08:00)
- Morning routine & breakfast
- Focused work sessions with breaks
- Lunch break
- Afternoon work/projects
- Exercise time
- Dinner
- Evening wind-down
- Bedtime routine`;

    console.log('Calling Lovable AI...');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let generatedText = aiData.choices[0].message.content;
    console.log('AI raw response:', generatedText.substring(0, 200));

    // Clean markdown and control characters
    generatedText = generatedText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .trim();

    let blocks;
    try {
      blocks = JSON.parse(generatedText);
      console.log(`Generated ${blocks.length} blocks`);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Cleaned response:', generatedText.substring(0, 500));
      throw new Error('Failed to parse AI response as JSON');
    }

    // Delete existing planned blocks for today
    const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    await supabase.from('blocks')
      .delete()
      .eq('user_id', userId)
      .eq('status', 'planned')
      .gte('start_at', todayStart)
      .lte('start_at', todayEnd);

    // Insert new blocks
    const blocksToInsert = blocks.map((block: any) => ({
      ...block,
      user_id: userId,
    }));

    const { error: insertError } = await supabase.from('blocks').insert(blocksToInsert);
    if (insertError) throw insertError;

    console.log('Day planning completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      blocksCreated: blocks.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in plan-my-day:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
