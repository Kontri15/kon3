import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { input } = await req.json();
    
    if (!input || typeof input !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Input text is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing task input:', input);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const systemPrompt = `You are a task parser for ChronoPilot. Extract structured task information from plain English input.

Task properties to extract:
- title: Clear, action-oriented task title (required)
- description: Detailed description if provided
- priority: 1-5 (1=low, 3=medium, 5=urgent) - infer from language like "urgent", "asap", "when possible"
- impact: 1-5 (business value/importance) - infer from context
- est_min: Estimated duration in minutes - infer from phrases like "quick task" (15min), "should take an hour" (60min), etc.
- energy_need: 1-5 (cognitive load required) - 5 for "deep work", "complex", 1 for "simple", "quick"
- tags: Array of relevant tags (e.g., ["deepwork", "coding", "personal"])
- project: Project name if mentioned (e.g., "ChronoPilot", "PS Digital")
- due_at: ISO timestamp if deadline mentioned (e.g., "tomorrow", "next week", "by Friday")
- location: "home", "office", or "any" if mentioned

Default values:
- priority: 2
- impact: 2
- energy_need: 2
- est_min: 30
- location: "any"

Examples:
Input: "Build authentication edge function by tomorrow, should take 2 hours"
Output: {
  "title": "Build authentication edge function",
  "priority": 3,
  "impact": 4,
  "est_min": 120,
  "energy_need": 4,
  "tags": ["coding", "backend", "deepwork"],
  "due_at": "[tomorrow's ISO date]"
}

Input: "Quick call with John about project status"
Output: {
  "title": "Call with John about project status",
  "priority": 2,
  "impact": 2,
  "est_min": 15,
  "energy_need": 1,
  "tags": ["meeting", "communication"]
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Parse this task: "${input}"` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_task",
              description: "Create a structured task from parsed information",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Clear task title" },
                  description: { type: "string", description: "Task description" },
                  priority: { type: "integer", minimum: 1, maximum: 5 },
                  impact: { type: "integer", minimum: 1, maximum: 5 },
                  est_min: { type: "integer", description: "Estimated minutes" },
                  energy_need: { type: "integer", minimum: 1, maximum: 5 },
                  tags: { type: "array", items: { type: "string" } },
                  project: { type: "string" },
                  due_at: { type: "string", description: "ISO timestamp" },
                  location: { type: "string", enum: ["home", "office", "any"] }
                },
                required: ["title"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_task" } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable AI workspace." }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0].message.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const parsedTask = JSON.parse(toolCall.function.arguments);
    console.log('Parsed task:', parsedTask);

    // Set defaults for missing fields
    const task = {
      user_id: '00000000-0000-0000-0000-000000000001', // Single-user app
      title: parsedTask.title,
      description: parsedTask.description || null,
      priority: parsedTask.priority || 2,
      impact: parsedTask.impact || 2,
      est_min: parsedTask.est_min || 30,
      energy_need: parsedTask.energy_need || 2,
      min_block_min: 25, // Default minimum work block
      tags: parsedTask.tags || [],
      project: parsedTask.project || null,
      due_at: parsedTask.due_at || null,
      location: parsedTask.location?.toUpperCase() || 'ANY',
      status: 'todo',
      biz_or_personal: parsedTask.project?.toLowerCase().includes('ps digital') ? 'biz' : 'personal'
    };

    return new Response(
      JSON.stringify({ task }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error parsing task:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
