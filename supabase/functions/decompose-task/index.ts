import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description, context, dueAt } = await req.json();
    
    console.log('Decomposing task:', { title, description, context, dueAt });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert task planner and time estimator. Your job is to decompose complex tasks into the smallest meaningful steps with accurate time estimates.

For each task, provide:
1. Steps: Break down into specific, actionable steps (each 15-90 min)
2. Artifacts: List deliverables/outputs from each step
3. Risks: Identify potential blockers or uncertainties
4. Checklist: Create a completion checklist
5. MVP Path: Suggest an 80/20 approach - which 20% gives 80% value
6. Time estimates: Total minutes and minimum block size

Be realistic with time estimates. Consider:
- Research/learning time
- Implementation time  
- Testing/debugging time
- Context switching overhead

Format your response as valid JSON only, no markdown.`;

    const userPrompt = `Decompose this task:

Title: ${title}
Description: ${description || 'No description provided'}
Context: ${context || 'No additional context'}
Due Date: ${dueAt || 'Not specified'}

Provide a detailed breakdown following this exact JSON structure:
{
  "steps": [
    {
      "title": "Step title",
      "description": "What to do",
      "estimatedMinutes": 60,
      "dependencies": []
    }
  ],
  "artifacts": ["Deliverable 1", "Deliverable 2"],
  "risks": ["Risk 1", "Risk 2"],
  "checklist": ["Check 1", "Check 2"],
  "mvpPath": "Description of the 80/20 approach",
  "totalEstimatedMinutes": 180,
  "minBlockMinutes": 60
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('AI response received');

    const content = data.choices[0].message.content;
    
    // Parse the JSON response
    let decomposition;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      decomposition = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse AI response as JSON');
    }

    console.log('Task decomposed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        decomposition 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in decompose-task function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
