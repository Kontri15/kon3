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

    const systemPrompt = `You are ChronoPilot's scheduling engine. Plan a personalized day for ${today.toISOString().split('T')[0]} (${dayOfWeek}) in Europe/Bratislava timezone.

USER PROFILE & DAILY ROUTINE:
- Wake time: 06:00
- Build mode focus (SACRED): 06:10-08:00 - highest priority cognitive/deep work
  * Prioritize based on tasks: urgent PS Digital work > ChronoPilot > personal projects/learning
  * Can be interrupted by journaling block (06:10-06:40, 30min) if important project/decision requires it
- Running: 07:00 weekdays, 07:30 weekends (schedule when possible)
- Shower: 07:40 weekdays, 08:00 weekends
- Breakfast: NONE (user does not eat breakfast)
- Lunch window: 12:00-12:45 (FIXED)
- Pre-bed routine: starts 21:30
- Lights out: 22:00
- Sleep goal: 7-8 hours (minimum 6.5h), optimize for quality

WORK SCHEDULE:
- Mon-Thu: On-site in office (arrive 08:30, leave 16:30)
- Fri: Home office
- Current priority: work on ChronoPilot app during morning build mode
- Meetings: few; sync from Outlook calendar

TRAINING & EXERCISE (6x per week):
- Gym split cycle: Push → Pull → Legs → Active (swim/sauna/walk) → Push → Pull → Legs
- Typical time: 17:00-18:00/18:30 Mon-Sat
- Progressive overload: +10% weight after 2 successful consecutive weeks; -5% if missed twice
- Football: Thursday variable time (17:00-18:30 window), optional, can replace gym as Active day
- Swimming: 17:00-18:30, use on Active/Rest days, prefer over sauna for cost reasons
- Sunday special: If hockey at 16:00, gym after hockey at 18:30-19:30
- Running: Already covered in daily routine above
- Yoga: 10-15min before bed
- Meditation: 10min before bed

SPORTS SCHEDULE (HARD-FIXED):
- Hockey team: HK Spišská Nová Ves
- Games: Friday 17:30 or Sunday 16:00
- Add ±10min pre/post buffers for hockey games
- Verify schedule daily from feed

NUTRITION:
- Meal pattern: base (rice, potatoes, fries, sometimes pasta) + main (salmon, steak, chicken, turkey, tuna, legumes)
- Lunch: 12:00-12:45 (FIXED)
- Rotation: 3 lunches, 2 dinners

SUPPLEMENTS:
- With dinner: Omega-3, Vitamin D3
- Training days: Creatine 3g (post-workout with dinner preferred; fallback: 30min pre-workout if dinner irregular)
- 90min before sleep: Magnesium, Ashwagandha
- Adjust pre-sleep timing dynamically using WHOOP predicted/last sleep

LOCATIONS:
- Default: Bratislava
- Secondary: Spišská Nová Ves (roughly once per month)
- Upcoming trip: Week of 2025-11-01 in SNV

PLANNING PREFERENCES:
- Heavy tasks first (frontload cognitive work)
- Build mode morning block 06:10-08:00 is SACRED (but can flex for journaling if needed)
- Minimize context switching (cluster by tags/projects)
- Breaks: 5-10min every 50-90min
- Day buffer: 10-15% unscheduled time
- Hard-fixed events ALWAYS respected
- Digital detox: Every other Saturday - suppress screen-heavy tasks, prefer gym/swimming/groceries/analog activities

SCHEDULING RULES:
1. Pack hard-fixed events first (events + rituals with hard_fixed=true, hockey games)
2. Build mode 06:10-08:00: prioritize urgent PS Digital tasks > ChronoPilot > personal projects
   - If tasks require journaling, schedule 06:10-06:40 journaling block, shift deep work after
3. Score tasks: (impact * 3) + (priority * 2) + (urgency_score) - (energy_mismatch_penalty)
4. Cluster by tags/projects to minimize context switching
5. Breaks: use "buffer" type for 5-10min rest every 50-90min
6. Meals: use "meal" type for lunch (12:00-12:45 FIXED), dinner (NO breakfast)
7. Exercise: 
   - Running: 07:00 weekdays, 07:30 weekends (schedule when possible)
   - Shower: 07:40 weekdays, 08:00 weekends
   - Gym: 17:00-18:30 Mon-Sat per PPL-Active-PPL cycle
   - Football: Thu 17:00-18:30 (optional, replaces gym as Active)
   - Swimming: 17:00-18:30 on Active/Rest days (prefer over sauna)
   - Sunday: If hockey 16:00, gym after at 18:30-19:30
   - Yoga/meditation: 10-15min + 10min before bed
8. Supplements: 
   - Dinner: Omega-3, D3, Creatine (on training days)
   - 90min before sleep: Magnesium, Ashwagandha
9. Sleep: bedtime routine at 21:30, sleep by 22:00
10. Day buffer: leave 10-15% unscheduled
11. If WHOOP recovery <40%, prioritize active recovery over intense work
12. Respect location constraints (home vs office vs any)
13. Honor earliest_start, hard_window_start, hard_window_end if present
14. Commute time on Mon-Thu: factor in travel to/from office
15. Digital detox Saturday (every other): suppress screen tasks, prefer gym/swim/analog activities

WHOOP DATA TODAY:
- Recovery: ${whoop.recovery_pct || 'N/A'}%
- HRV: ${whoop.hrv_ms || 'N/A'}ms
- RHR: ${whoop.rhr_bpm || 'N/A'}bpm
${whoop.recovery_pct && whoop.recovery_pct < 40 ? '\n⚠️ LOW RECOVERY - prioritize active recovery, reduce intensity' : ''}

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

IMPORTANT: Use "ritual" type for all exercise-related activities (running, shower, gym, yoga, meditation, etc.)

Use ISO 8601 timestamps in Europe/Bratislava timezone. Ensure no overlaps. Fill the entire day 06:00-22:00.`;

    const userPrompt = `
TASKS (${tasks.length}):
${tasks.length > 0 ? tasks.map(t => `- "${t.title}" [${t.est_min || 60}min, priority=${t.priority}, impact=${t.impact}, energy=${t.energy_need}, tags=${t.tags?.join(',') || 'none'}] ${t.due_at ? `DUE: ${t.due_at}` : ''}`).join('\n') : '(No tasks - create a balanced day with deep work, breaks, meals, and personal time)'}

RITUALS (${rituals.length}):
${rituals.length > 0 ? rituals.map(r => `- "${r.name}" [${r.duration_min}min, ${r.hard_fixed ? 'HARD-FIXED' : 'flexible'}, preferred=${r.preferred_start || 'any'}, days=${r.days_of_week?.join(',') || 'all'}]`).join('\n') : '(No rituals - suggest standard morning routine, exercise, meals, and wind-down)'}

EVENTS (${events.length}):
${events.length > 0 ? events.map(e => `- "${e.title}" [${e.start_at} to ${e.end_at}, ${e.hard_fixed ? 'HARD-FIXED' : 'flexible'}]`).join('\n') : '(No events)'}

Generate optimal schedule as JSON array. If no tasks/rituals exist, create a productive template day with:
- Deep work block (06:10-08:00) - prioritize based on task urgency/impact
- Running (07:00 weekdays / 07:30 weekends)
- Shower (07:40 weekdays / 08:00 weekends)
- Focused work sessions with breaks
- Lunch break (12:00-12:45)
- Afternoon work/projects
- Exercise time (gym/football/swimming per schedule)
- Dinner (with supplements on training days)
- Evening wind-down (yoga + meditation)
- Bedtime routine (21:30-22:00)`;


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
