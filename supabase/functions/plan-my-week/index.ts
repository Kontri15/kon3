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
      buildModeEnd = "08:00",
      userNotes = ""
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

    const systemPrompt = `You are ChronoPilot's weekly meal and training planner. Generate ONLY gym sessions and meals for the week starting ${weekStartIso} (Europe/Bratislava).

${userNotes ? `USER NOTES FOR PLANNING:
${userNotes}

IMPORTANT: Consider these user notes when planning the week. Adjust gym cycle position, meal rotation, and training focus accordingly.

` : ''}GOAL
- Generate ONLY 6 GYM sessions (Mon-Sat) and 14 MEALS (lunch + dinner for 7 days)
- Each GYM block must have detailed exercise prescriptions with sets, reps, and target weights
- Each MEAL block must specify what to cook/prepare
- Daily planning will handle work schedule, sleep, rituals, and other activities

TIME & FORMAT
- Timezone: Europe/Bratislava. Use ISO 8601 with explicit offset (+01:00 winter / +02:00 summer). Never use "Z".
- Output: JSON ARRAY with ~20 blocks (6 gym + 7 lunch + 7 dinner)
- Keys: title, start_at, end_at, type ("ritual" for gym | "meal" for meals), status ("planned"), notes, description

GYM SESSIONS
- 6×/week cycle: Push → Pull → Legs → Active → Push → Pull (Mon-Sat)
- Time slots (approximate, daily planner will adjust): 17:00-18:30
- Include 5min gym commute in the 90min window

WEEK TYPE (controls rep schemes)
- week_type = ${weekType}  // "Quantity" | "Intensity" | "Mixed"
  • Quantity: main lifts 6×10 @ ~60-65% 1RM, rest 60-90s
  • Intensity: 4 sets @ 12/8/6/4 reps, ramping to ~85-90% 1RM, rest 90-150s
  • Mixed: Mon-Wed use Quantity; Thu Active; Fri-Sat use Intensity

EXERCISE LIBRARY (choose 4-6 per session)
- PUSH: Barbell Bench Press, Incline DB Press, Overhead Press, Machine Chest Press, Cable Fly, Dips, Lateral Raises, Triceps Pushdown
- PULL: Deadlift or RDL (alternate weekly), Pull-ups/Lat Pulldown, Barbell Row, Face Pulls, Seated Cable Row, Biceps Curl
- LEGS: Back Squat or Front Squat (alternate weekly), Bulgarian Split Squat, Leg Press, Hamstring Curl, Leg Extension, Calf Raises, Core
- ACTIVE: Swimming 60min (17:00-18:00) + mobility work

WEIGHTS & PROGRESSION
- Use ${baselineLiftsJson} as baseline for exercises without history
- Check lifts_last_weights: ${JSON.stringify(lifts_last_weights)}
- Progressive overload: +10% if last 2 weeks successful, -5% if failed with "technique focus" note
- Show explicit target weights (kg) for every exercise

MEALS
- LUNCH (12:00-12:45): Base + main protein (e.g., "Rice with salmon", "Potatoes with chicken", "Pasta with beef")
  - Avoid repeating same main 3 days in a row
  - Last 7 lunches: ${JSON.stringify(lunches_last_7)}
- DINNER (18:45-19:15 approximate): Simple rotation
  - Option A: Bread with ham (cheese, butter, vegetables)
  - Option B: Bread with eggs (scrambled or fried)
  - Option C: Yogurt with cereals and fruit
  - Avoid same dinner 3 nights consecutively
  - Last 7 dinners: ${JSON.stringify(dinners_last_7)}

SUPPLEMENTS (add to meal descriptions)
- Lunch: None required
- Dinner: Omega-3, Vitamin D3, Creatine 3g (on training days)
- Note: Daily planner will schedule pre-bed supplements (Magnesium, Ashwagandha) separately

WORKOUT HISTORY (for progression)
- Recent workouts: ${JSON.stringify(workouts_last_14)}

OUTPUT FORMAT
Return ONLY a JSON array of blocks. Example:
[
  {
    "title": "Gym | PUSH — Quantity",
    "start_at": "2025-11-03T17:00:00+01:00",
    "end_at": "2025-11-03T18:30:00+01:00",
    "type": "ritual",
    "status": "planned",
    "description": "PUSH — Quantity (6×10 @ 62% 1RM)\\n1) Bench Press — 6×10 @ 50 kg, rest 90s\\n2) Incline DB Press — 6×10 @ 22.5 kg/hand, rest 90s\\n3) Overhead Press — 6×10 @ 32.5 kg, rest 90s\\n4) Machine Chest Press — 6×10 @ 45 kg, rest 60s\\n5) Lateral Raises — 5×12 @ 7.5 kg, rest 60s\\n6) Triceps Pushdown — 4×12 @ 20 kg, rest 60s",
    "notes": "Progressive overload: +10% from last week. Includes 5min commute each way."
  },
  {
    "title": "Lunch — Rice with salmon",
    "start_at": "2025-11-03T12:00:00+01:00",
    "end_at": "2025-11-03T12:45:00+01:00",
    "type": "meal",
    "status": "planned",
    "description": "White rice (200g cooked) with grilled salmon fillet (150g), steamed broccoli, olive oil drizzle",
    "notes": "High protein post-morning session"
  },
  {
    "title": "Dinner — Bread with ham",
    "start_at": "2025-11-03T18:45:00+01:00",
    "end_at": "2025-11-03T19:15:00+01:00",
    "type": "meal",
    "status": "planned",
    "description": "Whole grain bread (3-4 slices) with ham, cheese slices, butter, cucumber, tomatoes",
    "notes": "Post-workout meal. Take: Omega-3, D3, Creatine 3g"
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
