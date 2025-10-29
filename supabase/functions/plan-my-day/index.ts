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
    const [tasksRes, ritualsRes, eventsRes, profileRes, whoopRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('status', 'todo'),
      supabase.from('rituals').select('*'),
      supabase.from('events').select('*').gte('start_at', new Date().toISOString()),
      supabase.from('profiles').select('*').single(),
      supabase.from('whoop_daily').select('*').eq('date', new Date().toISOString().split('T')[0]).single()
    ]);

    const tasks: Task[] = tasksRes.data || [];
    const rituals: Ritual[] = ritualsRes.data || [];
    const events: Event[] = eventsRes.data || [];
    
    // Use database profile or sensible defaults
    const profileData = profileRes.data;
    const profile: Profile = {
      build_mode: profileData?.build_mode ?? true,
      home_city: profileData?.home_city ?? 'BA',
      work_arrival: profileData?.work_arrival ?? '08:30:00',
      work_leave: profileData?.work_leave ?? '16:30:00',
      friday_home_office: profileData?.friday_home_office ?? true,
      bedtime: profileData?.bedtime ?? '22:00:00',
      prebed_start: profileData?.prebed_start ?? '21:30:00'
    };
    
    const whoopData = whoopRes.data;
    const whoop: WhoopData = {
      recovery_pct: whoopData?.recovery_pct,
      hrv_ms: whoopData?.hrv_ms,
      rhr_bpm: whoopData?.rhr_bpm,
      sleep_perf_pct: whoopData?.sleep_perf_pct
    };

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

    // Calculate wake time from bedtime and sleep target
    const bedtimeHours = parseInt(profile.bedtime?.split(':')[0] || '22');
    const bedtimeMinutes = parseInt(profile.bedtime?.split(':')[1] || '0');
    const prebedHours = parseInt(profile.prebed_start?.split(':')[0] || '21');
    const prebedMinutes = parseInt(profile.prebed_start?.split(':')[1] || '30');
    
    // Wake time is bedtime + 8 hours (default sleep target)
    const wakeHours = (bedtimeHours + 8) % 24;
    const wakeTime = `${String(wakeHours).padStart(2, '0')}:00`;
    const buildModeStart = `${String(wakeHours).padStart(2, '0')}:10`;
    const buildModeEnd = `${String((wakeHours + 2) % 24).padStart(2, '0')}:00`;
    
    const systemPrompt = `YYou are ChronoPilot's scheduling engine. Plan a personalized day for ${today.toISOString().split('T')[0]} (${dayOfWeek}) in Europe/Bratislava timezone.

TIMEZONE & FORMAT (CRITICAL)
- All times are Europe/Bratislava. Use ISO 8601 with explicit offset (+01:00 winter, +02:00 summer).
- NEVER use "Z" / UTC. Do not shift local times.
- No overlaps: each block ends exactly when the next begins (or leave intentional buffer).
- Every block duration >= 5 minutes.

USER PROFILE & DAILY ROUTINE (ALL TIMES Europe/Bratislava)
- Wake: ${wakeTime} EXACTLY
- Build mode (SACRED): ${buildModeStart}-${buildModeEnd} EXACTLY — highest priority cognitive/deep work
  • Prioritize: urgent PS Digital work > ChronoPilot > personal learning
  • If an important project requires journaling, schedule it inside build mode and shift deep work after
- Running: START 07:00 on weekdays, 07:30 on weekends (30 min) when possible (suppressed during intense build mode)
- Shower: 10 min (07:40 weekdays / 08:00 weekends)
- Breakfast: NONE
- Lunch: 12:00–12:45 EXACTLY (45 min FIXED)
  • MUST specify actual meal from rotation: base (rice/potatoes/fries/pasta) + main (salmon/steak/chicken/turkey/tuna/legumes)
  • Example: "Lunch: Rice with grilled salmon"
- Pre-bed routine: ${profile.prebed_start} EXACTLY
- Lights out: ${profile.bedtime} EXACTLY
- Sleep goal: 7–8 h (minimum 6.5 h) — optimize for quality

WORK SCHEDULE
- Mon–Thu: On-site (arrive 08:30, leave 16:30). Fri: Home office.
- Meetings: few; synced from Outlook (events table).
- Current priority: ChronoPilot app during morning build mode.

TRAINING & EXERCISE (6×/week)
- Split cycle: Push → Pull → Legs → Active (swim/sauna/walk) → Push → Pull → Legs
- Typical gym time: 17:00–18:00/18:30 (Mon–Sat). Commute to/from gym: 5 min each way.
- Progressive overload: +10% weight after 2 consecutive successful weeks; −5% if missed twice; add “technique focus”.
- Football: Thursday variable (17:00–18:30 window), optional, can replace gym as Active day.
- Swimming: 17:00–18:30 on Active/Rest days (prefer over sauna for cost reasons).
- Sunday rule: If hockey at 16:00, gym AFTER hockey at 18:30–19:30.
- Yoga: 10–15 min before bed; Meditation: 10 min before bed.

SPORTS (HARD-FIXED)
- Hockey: HK Spišská Nová Ves
- Use EXACT times from events table (e.g., 15:50–19:10). Do NOT round to hour.
- If no event exists for today and it's Sunday, default 16:00–18:00. Add ±10 min pre/post buffers if not present.
- Verify schedule daily from feed.

NUTRITION
- Lunch (fixed): 12:00–12:45 — specify base+main (e.g., “Potatoes with chicken breast”).
- Dinner (simple rotation): "Bread with ham (cheese, butter, vegetables)" OR "Bread with eggs" OR "Yogurt with cereals".
- Hockey days: dinner BEFORE or DURING hockey, NOT after gym.

SUPPLEMENTS
- With dinner: Omega-3, Vitamin D3.
- Training days: Creatine 3g (prefer post-workout with dinner; fallback 30 min pre-workout if dinner irregular).
- 90 min before sleep: Magnesium, Ashwagandha.
- Adjust pre-sleep timing dynamically using WHOOP predicted/last sleep.

LOCATIONS
- Default: Bratislava. Secondary: Spišská Nová Ves (roughly monthly).
- Upcoming trip: Week of 2025-11-01 in SNV.
- Respect commute assumptions (5 min to gym).

PLANNING PREFERENCES
- Heavy tasks first (frontload cognitive work).
- Build mode 06:10–08:00 is SACRED (can flex for journaling when critical).
- Minimize context switching; cluster by tags/projects.
- Breaks: 5–10 min every 50–90 min (use type "buffer").
- Day buffer: 10–15% unscheduled time.
- Hard-fixed events ALWAYS respected.
- Digital detox: every other Saturday — suppress screen-heavy tasks; prefer gym/swimming/groceries/analog.

HISTORY WINDOW (LAST 7 DAYS) — USE TO AVOID REPETITION AND PICK CORRECT NEXT SPLIT
- Provided as JSON arrays:
  • workouts_last_7: ${JSON.stringify(history.workouts_last_7) || "[]"}
    – Each item: {date, split: "Push|Pull|Legs|Active|Rest", notes}
  • dinners_last_7: ${JSON.stringify(history.dinners_last_7) || "[]"}
    – Each item: {date, dinner: "Bread with ham|Bread with eggs|Yogurt with cereals"}
  • lunches_last_7: ${JSON.stringify(history.lunches_last_7) || "[]"} (base+main combos)
  • detox_saturday_flag: ${history.detox_saturday_flag ? "true" : "false"}
- Rules:
  • Do NOT schedule the same dinner 3 nights in a row.
  • Advance the gym split based on workouts_last_7 (never repeat the same split two days in a row unless “Active”).
  • If detox_saturday_flag=true: suppress screen-heavy tasks; favor analog activities.

OPTIONAL MICRO-RITUALS INPUT (DAY-SPECIFIC)
- If provided as micro_rituals_today[], treat items marked "Fixed" as hard-fixed for TODAY only.
- Otherwise, treat as suggestions (soft).

SCHEDULING RULES (CRITICAL)
1) Place hard-fixed events first (Outlook events, hockey, any “Fixed” micro-rituals).
2) Build mode ${buildModeStart}-${buildModeEnd} EXACTLY:
   - Priority queue: urgent PS Digital > ChronoPilot > personal learning.
   - If journaling is required, schedule inside build mode (e.g., 06:10–06:40), then deep work.
3) Task scoring: (impact * 3) + (priority * 2) + (urgency_score) − (energy_mismatch_penalty).
4) Cluster by tags/projects to minimize context switches.
5) Breaks: insert 5–10 min buffers every 50–90 min.
6) Meals:
   - Lunch 12:00–12:45 EXACTLY (type "meal") with explicit base+main string.
   - Dinner (type "meal"): choose from simple rotation; consider history to avoid repeats.
   - No breakfast.
7) Exercise (type "ritual"):
   - Running at START 07:00 weekdays / 07:30 weekends (30 min).
   - Shower 10 min (07:40 weekdays / 08:00 weekends).
   - Gym 17:00–18:00/18:30 per PPL-Active-PPL (5 min commute before/after).
   - Football Thu 17:00–18:30 (optional, replaces gym as Active).
   - Swimming 17:00–18:30 on Active/Rest days.
   - Sunday hockey rule: gym after hockey 18:30–19:30.
   - Yoga 10–15 min + Meditation 10 min before bed.
8) Supplements:
   - With dinner: Omega-3, D3, Creatine (on training days).
   - 90 min before sleep: Magnesium, Ashwagandha.
9) Sleep: One continuous block from ${profile.bedtime} to ${wakeTime} next day (type "sleep").
   - Pre-bed routine is a separate "ritual" from ${profile.prebed_start} to ${profile.bedtime}.
10) Day buffer: leave 10–15% unscheduled.
11) WHOOP low recovery (<40%): prioritize Active recovery over intense work; shorten first deep-work block and add extra buffer.
12) Respect earliest_start, hard_window_start, hard_window_end if present.
13) Commute rules: include 5 min to/from gym.
14) Digital-detox Saturday: suppress screen tasks; prefer analog.

REFERENCE DAY TEMPLATE (FOR HEURISTICS, NOT FOR BLIND COPYING)
- If a reference_day[] array is passed for TODAY, use entries marked “Fixed” as hard-fixed and preserve their exact times.
- Example array (capturing user’s real pattern):
  06:00 Wake (Fixed)
  06:00–06:02 30 push-ups (Fixed)
  06:02–06:04 Brush teeth (Fixed)
  06:04–06:06 Get dressed (Fixed)
  06:06–06:08 Weigh myself (Fixed)
  06:08–06:14 Think through “Jojka”
  06:14–06:20 Think through tasking
  06:20–06:30 Spinal rotation exercises
  06:30–06:55 Work on presentation
  06:55–07:00 Slice potatoes
  07:00–07:30 Run (Fixed)
  07:30–07:40 Shower (Fixed)
  07:40–07:50 Finish cooking (Fixed)
  07:50–08:00 Read (Fixed)
  08:10–08:30 Commute to office
  08:30–09:00 Team stand-up
  09:00–… (rest of the day analog to tasks/events)

WHOOP TODAY
- Recovery: ${whoop.recovery_pct || 'N/A'}%
- HRV: ${whoop.hrv_ms || 'N/A'} ms
- RHR: ${whoop.rhr_bpm || 'N/A'} bpm
${whoop.recovery_pct && whoop.recovery_pct < 40 ? '\n⚠️ LOW RECOVERY — prioritize Active recovery, reduce intensity.' : ''}

OUTPUT FORMAT
Return ONLY a JSON array of blocks:
[
  {
    "title": "Block title",
    "start_at": "2025-10-26T06:10:00+01:00",
    "end_at": "2025-10-26T08:00:00+01:00",
    "type": "task" | "ritual" | "event" | "meal" | "sleep" | "buffer" | "commute",
    "status": "planned",
    "task_id": "uuid-or-null",
    "ritual_id": "uuid-or-null",
    "notes": "Optional context"
  }
]
IMPORTANT: Use "ritual" type for running, shower, gym, yoga, meditation, etc.


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
        model: 'google/gemini-2.5-pro',
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

    // Helper function to format dates with Europe/Bratislava timezone offset
    const formatWithTimezoneOffset = (date: Date): string => {
      // Detect DST (Daylight Saving Time) for Europe/Bratislava
      const jan = new Date(date.getFullYear(), 0, 1);
      const jul = new Date(date.getFullYear(), 6, 1);
      const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
      const isDST = date.getTimezoneOffset() < stdOffset;
      const offset = isDST ? '+02:00' : '+01:00';
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offset}`;
    };

    // Log AI-generated blocks for debugging
    console.log('AI-generated blocks (first 3):');
    blocks.slice(0, 3).forEach((b: any) => {
      console.log(`  - "${b.title}": ${b.start_at} to ${b.end_at}`);
    });

    // Fix 0-duration blocks
    blocks = blocks.map((block: any) => {
      const start = new Date(block.start_at);
      const end = new Date(block.end_at);
      const durationMs = end.getTime() - start.getTime();
      
      if (durationMs <= 0) {
        console.warn(`Fixing 0-duration block: "${block.title}"`);
        const fixedEnd = new Date(start.getTime() + 30 * 60 * 1000);
        block.end_at = formatWithTimezoneOffset(fixedEnd);
      }
      
      return block;
    });

    // Validate and fix sleep block
    const sleepBlock = blocks.find((b: any) => 
      b.type === 'sleep' || 
      b.title.toLowerCase().includes('sleep') || 
      b.title.toLowerCase().includes('lights')
    );

    if (sleepBlock) {
      const sleepStart = new Date(sleepBlock.start_at);
      const sleepEnd = new Date(sleepBlock.end_at);
      const sleepDurationHours = (sleepEnd.getTime() - sleepStart.getTime()) / (1000 * 60 * 60);
      
      // If sleep duration is wrong, fix it using profile settings
      if (sleepDurationHours < 6 || sleepDurationHours > 10) {
        console.warn(`Fixing sleep block duration: "${sleepBlock.title}" (was ${sleepDurationHours.toFixed(1)}h)`);
        const sleepStartDate = new Date(today);
        sleepStartDate.setHours(bedtimeHours, bedtimeMinutes, 0, 0);
        
        const sleepEndDate = new Date(sleepStartDate);
        sleepEndDate.setDate(sleepEndDate.getDate() + 1);
        sleepEndDate.setHours(wakeHours, 0, 0, 0);
        
        sleepBlock.start_at = formatWithTimezoneOffset(sleepStartDate);
        sleepBlock.end_at = formatWithTimezoneOffset(sleepEndDate);
      }
    }

    // Add sleep block if missing
    if (!sleepBlock) {
      console.warn('No sleep block found - adding default sleep block');
      const sleepStartDate = new Date(today);
      sleepStartDate.setHours(bedtimeHours, bedtimeMinutes, 0, 0);
      const sleepEndDate = new Date(sleepStartDate);
      sleepEndDate.setDate(sleepEndDate.getDate() + 1);
      sleepEndDate.setHours(wakeHours, 0, 0, 0);
      
      blocks.push({
        title: 'Sleep',
        start_at: formatWithTimezoneOffset(sleepStartDate),
        end_at: formatWithTimezoneOffset(sleepEndDate),
        type: 'sleep',
        status: 'planned',
        task_id: null,
        ritual_id: null,
        notes: 'Target: 8 hours'
      });
    }

    // Sort blocks by start time
    blocks.sort((a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    // Fix overlapping blocks
    for (let i = 0; i < blocks.length - 1; i++) {
      const currentEnd = new Date(blocks[i].end_at);
      const nextStart = new Date(blocks[i + 1].start_at);
      
      if (currentEnd > nextStart) {
        console.warn(`Overlap detected: ${blocks[i].title} (ends ${currentEnd.toISOString()}) overlaps with ${blocks[i + 1].title} (starts ${nextStart.toISOString()})`);
        // Fix: adjust current block's end time to match next block's start
        blocks[i].end_at = blocks[i + 1].start_at;
      }
    }

    // Match task blocks to actual tasks in database
    console.log('Matching task blocks to database tasks...');
    const taskBlocks = blocks.filter((b: any) => b.type === 'task');
    let matchedCount = 0;
    
    for (const block of taskBlocks) {
      // Try exact match first (case-insensitive)
      const blockTitle = block.title.toLowerCase().trim();
      let matchedTask = tasks.find(t => t.title.toLowerCase().trim() === blockTitle);
      
      // If no exact match, try fuzzy match (check if task title is contained in block title or vice versa)
      if (!matchedTask) {
        matchedTask = tasks.find(t => {
          const taskTitle = t.title.toLowerCase().trim();
          return blockTitle.includes(taskTitle) || taskTitle.includes(blockTitle);
        });
      }
      
      if (matchedTask) {
        block.task_id = matchedTask.id;
        matchedCount++;
        console.log(`  ✓ Matched "${block.title}" → task "${matchedTask.title}"`);
      } else {
        console.warn(`  ✗ No match for task block: "${block.title}"`);
        block.task_id = null;
      }
    }
    
    console.log(`Task matching complete: ${matchedCount}/${taskBlocks.length} blocks matched`);

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

    console.log('Inserting blocks (first 3):');
    blocksToInsert.slice(0, 3).forEach((b: any) => {
      console.log(`  - "${b.title}": ${b.start_at} to ${b.end_at}`);
    });

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
