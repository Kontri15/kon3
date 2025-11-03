import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Baseline lifts when no history is available
const baselineLifts: Record<string, number> = {
  "Bench Press": 50,
  "Overhead Press": 32.5,
  "Incline DB Press": 22.5,
  "Machine Chest Press": 45,
  "Lateral Raises": 7.5,
  "Triceps Pushdown": 20,
  "Deadlift": 80,
  "RDL": 70,
  "Pull-ups": 0, // bodyweight
  "Lat Pulldown": 50,
  "Barbell Row": 50,
  "Seated Cable Row": 45,
  "Face Pulls": 15,
  "Biceps Curl": 12.5,
  "Back Squat": 70,
  "Front Squat": 60,
  "Bulgarian Split Squat": 15,
  "Leg Press": 100,
  "Hamstring Curl": 35,
  "Leg Extension": 40,
  "Calf Raises": 50
};

// Parse exercise from block description (e.g., "Bench Press — 6×10 @ 50 kg")
function parseExercises(description: string): Array<{exercise: string, sets?: number, reps?: number, weight?: number}> {
  const exercises: Array<{exercise: string, sets?: number, reps?: number, weight?: number}> = [];
  const lines = description.split('\n');
  
  for (const line of lines) {
    // Pattern: "1) Bench Press — 6×10 @ 50 kg"
    const match = line.match(/(?:\d+\)|-)?\s*([A-Za-z\s]+?)(?:\s*—\s*(\d+)\s*[×x]\s*(\d+)\s*@\s*(\d+(?:\.\d+)?)\s*kg)?/);
    if (match) {
      const exercise = match[1].trim();
      if (exercise && exercise.length > 3) {
        exercises.push({
          exercise,
          sets: match[2] ? parseInt(match[2]) : undefined,
          reps: match[3] ? parseInt(match[3]) : undefined,
          weight: match[4] ? parseFloat(match[4]) : undefined
        });
      }
    }
  }
  
  return exercises;
}

// Extract last known weights from workout history
function buildLiftsLastWeights(workoutBlocks: any[]): Record<string, {weight_kg: number, date: string, success: boolean}> {
  const lifts: Record<string, {weight_kg: number, date: string, success: boolean}> = {};
  
  for (const block of workoutBlocks) {
    const description = block.description || block.notes || '';
    const exercises = parseExercises(description);
    const success = !(description.toLowerCase().includes('fail') || description.toLowerCase().includes('incomplete'));
    
    for (const ex of exercises) {
      if (ex.weight && ex.exercise) {
        const existing = lifts[ex.exercise];
        if (!existing || new Date(block.start_at) > new Date(existing.date)) {
          lifts[ex.exercise] = {
            weight_kg: ex.weight,
            date: block.start_at,
            success
          };
        }
      }
    }
  }
  
  return lifts;
}

// Extract workout history for progression tracking
function buildWorkoutsLast14(blocks: any[]): Array<{date: string, split: string, success: boolean, exercises: string[]}> {
  const workouts: Array<{date: string, split: string, success: boolean, exercises: string[]}> = [];
  
  for (const block of blocks) {
    if (block.type === 'ritual' && block.title?.toLowerCase().includes('gym')) {
      const description = block.description || block.notes || '';
      const split = block.title.includes('PUSH') ? 'PUSH' : 
                    block.title.includes('PULL') ? 'PULL' :
                    block.title.includes('LEGS') ? 'LEGS' : 'ACTIVE';
      const success = !(description.toLowerCase().includes('fail') || description.toLowerCase().includes('incomplete'));
      const exercises = parseExercises(description).map(e => e.exercise);
      
      workouts.push({
        date: block.start_at,
        split,
        success,
        exercises
      });
    }
  }
  
  return workouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Extract meal history
function buildMealHistory(blocks: any[], days: number): string[] {
  const meals: string[] = [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  for (const block of blocks) {
    if (block.type === 'meal' && new Date(block.start_at) >= cutoffDate) {
      const meal = block.description || block.title || '';
      if (meal) meals.push(meal);
    }
  }
  
  return meals;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      weekStartIso, 
      weekType = "Mixed",
      wakeTime = "06:00",
      buildModeStart = "06:15",
      buildModeEnd = "08:00"
    } = await req.json();
    
    console.log("Planning week:", weekStartIso, "Type:", weekType);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .single();

    // Fetch events for the week (hard-fixed)
    const weekStart = new Date(weekStartIso);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .gte('start_at', weekStart.toISOString())
      .lte('end_at', weekEnd.toISOString());

    // Fetch blocks from last 14 days for history
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    const { data: historicalBlocks } = await supabase
      .from('blocks')
      .select('*')
      .gte('start_at', twoWeeksAgo.toISOString())
      .order('start_at', { ascending: true });

    // Build history helpers
    const workouts_last_14 = buildWorkoutsLast14(historicalBlocks || []);
    const lifts_last_weights = buildLiftsLastWeights(historicalBlocks?.filter(b => 
      b.type === 'ritual' && b.title?.toLowerCase().includes('gym')
    ) || []);
    
    const allMealBlocks = historicalBlocks?.filter(b => b.type === 'meal') || [];
    const lunches_last_7 = buildMealHistory(allMealBlocks.filter(b => 
      b.title?.toLowerCase().includes('lunch')
    ), 7);
    const dinners_last_7 = buildMealHistory(allMealBlocks.filter(b => 
      !b.title?.toLowerCase().includes('lunch')
    ), 7);
    
    // Check for detox Saturday flag (alternating logic or existing block)
    const detox_saturday_flag = historicalBlocks?.some(b => 
      b.title?.toLowerCase().includes('detox') && 
      new Date(b.start_at).getDay() === 6
    ) || false;

    // Use Lovable AI to generate week plan
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const baselineLiftsJson = JSON.stringify(baselineLifts);

    const systemPrompt = `You are ChronoPilot's weekly planner. Plan a 7-day schedule starting on ${weekStartIso} (Europe/Bratislava).

GOAL
- Produce a realistic weekly plan with time-blocks for work, training, meals, sleep, and rituals.
- For each GYM block, include a detailed DESCRIPTION: exercises, sets x reps, target weights, rest times, and progression notes.
- For each MEAL block (lunch & dinner), include a DESCRIPTION of the actual meal (rotation rules).

TIME & FORMAT
- Timezone: Europe/Bratislava. Use ISO 8601 with explicit offset (+01:00 winter / +02:00 summer). Never use "Z".
- No overlaps; every block ≥ 5 minutes.
- Output: a single JSON ARRAY of blocks spanning 7 days (Mon–Sun or ${weekStartIso} .. +6 days).
- Use these keys exactly: title, start_at, end_at, type ("task"|"ritual"|"event"|"meal"|"sleep"|"buffer"|"commute"), status ("planned"), notes, description.

USER BASELINE (pull from profile)
- Wake at ${wakeTime}, build mode ${buildModeStart}-${buildModeEnd} (morning deep work is sacred unless journaling is required).
- Office: Mon–Thu 08:30–16:30 on-site; Fri home office.
- Lunch fixed 12:00–12:45.
- Pre-bed routine ${profile?.prebed_start || '21:30'}, lights out ${profile?.bedtime || '22:00'}. Sleep target 7–8 h (min 6.5).
- Gym commute: 5 min each way.
- Hockey: HK Spišská Nová Ves → treat as HARD-FIXED from events table (add ±10 min buffers if missing). Sunday default 16:00–18:00 if no event present, then gym 18:30–19:30.
- Dinner rotation (simple): Bread with ham (cheese, butter, vegetables) OR Bread with eggs OR Yogurt with cereals.
- Breakfast: none.

WEEK TYPE (controls rep-schemes)
- week_type = ${weekType}  // "Quantity" | "Intensity" | "Mixed"
  • Quantity: main lifts 6×10 @ ~60–65% 1RM, rest 60–90s.
  • Intensity: 4 sets @ 12/8/6/4 reps, ramping to ~85–90% 1RM on last set, rest 90–150s.
  • Mixed: use Quantity for Mon–Wed; Intensity for Fri–Sat; Thu = Active.

GYM SPLIT & TIMES
- 6×/week cycle: Push → Pull → Legs → Active → Push → Pull → Legs.
- Typical time: 17:00–18:00/18:30 (Mon–Sat). Sunday follows hockey rule.
- Football: Thursday variable; treat as optional Active session that can replace the Active day.
- Swimming: 17:00–18:30 on Active/Rest days (prefer over sauna).

EXERCISE LIBRARY (choose 4–6 per day)
- PUSH: Barbell Bench Press, Incline DB Press, Overhead Press, Machine Chest Press, Cable Fly or Dips, Lateral Raises, Triceps Pushdown.
- PULL: Deadlift or RDL (alternate weekly), Pull-ups/Lat Pulldown, Barbell Row/Chest-supported Row, Face Pulls, Seated Cable Row, Biceps Curl variant.
- LEGS: Back Squat or Front Squat (alternate weekly), Bulgarian Split Squat or Walking Lunges, Leg Press, Hamstring Curl, Leg Extension, Calf Raises, Core.
- ACTIVE: Swim 40–60 min (or 10–12k steps brisk walk) + mobility.

WEIGHTS & PROGRESSION
- Read last known loads from prior blocks' notes/description if present (look for patterns like "Bench 50 kg", "Chest press 45 kg").
- If no history present for a lift, use ${baselineLiftsJson} as baseline (per exercise name).
- Progressive overload rule: if the same lift was successfully completed for 2 consecutive weeks, increase target by +10% this week; if failed 2×, reduce −5% and mark "technique focus".
- Always show target loads explicitly in DESCRIPTION (kg) per set scheme.

MEALS (WEEK ROTATION)
- Lunch every day 12:00–12:45 (meal type): MUST specify "base with main" (e.g., "Rice with salmon"). Avoid repeating the same main 3 days in a row.
- Dinner every day (meal type) in an evening window (e.g., 18:30–21:00 depending on hockey/gym): choose from the simple rotation; avoid same dinner 3 nights consecutively.
- On hockey days: dinner BEFORE or DURING the game, not after post-game gym.

SUPPLEMENTS
- With dinner: Omega-3, D3. Training days: Creatine 3 g (default post-workout with dinner; fallback 30 min pre-workout). 90 min before sleep: Magnesium, Ashwagandha.
- Add these in DESCRIPTION of the relevant MEAL/PRE-BED blocks.

HISTORY INPUTS (provided by backend)
- workouts_last_14: ${JSON.stringify(workouts_last_14)}
- lifts_last_weights: ${JSON.stringify(lifts_last_weights)}
- lunches_last_7: ${JSON.stringify(lunches_last_7)}
- dinners_last_7: ${JSON.stringify(dinners_last_7)}
- detox_saturday_flag: ${detox_saturday_flag}

PLANNING RULES (WEEK)
1) Place hard-fixed events first (Outlook meetings, hockey).
2) For each day, keep morning build mode ${buildModeStart}-${buildModeEnd}. If journaling is required, schedule it first inside build mode.
3) Insert lunch 12:00–12:45 (meal type, with explicit base+main).
4) Schedule gym 17:00–18:00/18:30 according to split; insert 5-min commute before/after.
   - Sunday: if hockey exists ≈16:00–18:00, set gym 18:30–19:30.
5) Fill remaining with focused work blocks, buffers (5–10 min every 50–90 min), and evening wind-down (yoga + meditation).
6) For Active day (Thu by default), schedule swimming 17:00–18:30 or football if present.
7) Respect location (BA/SNV) if provided; do not plan breakfast.
8) Keep 10–15% weekly buffer (unscheduled).
9) Digital-detox Saturday (if alternating & enabled): suppress screen-heavy tasks; allow gym/swim/groceries/analog activities.

BLOCK CONTENT REQUIREMENTS
- Every GYM block must include DESCRIPTION with:
  • Split & session goal (Quantity/Intensity/Mixed)  
  • Exercise list (4–6), sets×reps scheme, target weight per exercise (kg), rest guidance  
  • Progression note (e.g., "+10% vs last week" or "-5% technique focus")  
  Example:
  "DESCRIPTION": "PUSH — Quantity (6×10 @ ~62% 1RM)\\n1) Bench Press — 6×10 @ 50 kg, rest 90s\\n2) Incline DB Press — 6×10 @ 22.5 kg/hand\\n3) Overhead Press — 6×10 @ 32.5 kg\\n4) Lateral Raises — 5×12 @ 7.5 kg\\nCreatine 3 g post-workout; commute ±5 min."
- Every MEAL block must include DESCRIPTION with the chosen dish:
  • Lunch: "Rice with salmon / Potatoes with chicken / ..."
  • Dinner: "Bread with ham (cheese, butter, veg)" OR "Bread with eggs" OR "Yogurt with cereals"
  • Add supplement notes to dinner when relevant.

OUTPUT FORMAT (single JSON array of blocks for the whole week):
Return ONLY the JSON array, no additional text.`;

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

    // Delete existing blocks for this week to avoid duplicates
    await supabase
      .from('blocks')
      .delete()
      .gte('start_at', weekStart.toISOString())
      .lte('start_at', weekEnd.toISOString());

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

    // TODO: Outlook calendar integration would go here
    // Requires Microsoft Graph API setup with OAuth2
    // Map blocks to Outlook events: notes->bodyPreview, description->body.content

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
