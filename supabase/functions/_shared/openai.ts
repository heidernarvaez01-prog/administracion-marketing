// Centralizes the raw fetch to OpenAI's chat completions endpoint —
// previously duplicated in audit-insight, weekly-report and
// metrics-ai-analysis (three near-identical copies of the same fetch +
// error handling). Same spirit as _shared/email.ts for Resend.
export interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** Set on an assistant message that requested one or more tool calls. */
  tool_calls?: OpenAiToolCall[];
  /** Set on a 'tool' role message — pairs the result with the call that requested it. */
  tool_call_id?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    /** JSON Schema object describing the function's arguments. */
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionParams {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Forces a valid-JSON response body (OpenAI's `response_format: json_object`).
   *  The prompt must itself instruct the model to return JSON — this only
   *  enforces it, it doesn't add the instruction. */
  jsonMode?: boolean;
  /** Tool menu offered to the model (OpenAI function-calling). Omit for a
   *  plain completion — every existing caller (audit-insight, weekly-report,
   *  metrics-ai-analysis, alert-dispatch, ai-insights) keeps working
   *  unchanged since this is optional. */
  tools?: ToolDefinition[];
}

export interface ChatCompletionResult {
  ok: boolean;
  content: string;
  status?: number;
  error?: string;
  rateLimited?: boolean;
  /** Present when the model chose to call one or more tools instead of
   *  (or in addition to) answering directly. */
  toolCalls?: OpenAiToolCall[];
}

export async function chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return { ok: false, content: '', error: 'OPENAI_API_KEY is not configured' };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens ?? 800,
        ...(params.temperature != null ? { temperature: params.temperature } : {}),
        ...(params.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        ...(params.tools?.length ? { tools: params.tools } : {}),
        messages: params.messages,
      }),
    });

    if (res.status === 429) {
      return { ok: false, content: '', status: 429, rateLimited: true, error: 'Rate limit exceeded' };
    }
    if (!res.ok) {
      const text = await res.text();
      console.error('OpenAI API error:', res.status, text);
      return { ok: false, content: '', status: res.status, error: `OpenAI API error (${res.status})` };
    }

    const data = await res.json();
    const message = data?.choices?.[0]?.message;
    const content = message?.content ?? '';
    const toolCalls: OpenAiToolCall[] | undefined = message?.tool_calls?.length ? message.tool_calls : undefined;
    return { ok: true, content, toolCalls };
  } catch (e) {
    return { ok: false, content: '', error: (e as Error).message };
  }
}

// ── Tool-calling orchestration ──────────────────────────────────────────
// Runs the full "model asks for data → we fetch it → model asks again"
// cycle so callers (metrics-ai-analysis) just describe their tools and get
// a final answer back, instead of hand-rolling the multi-turn loop.

export interface ToolHandlerDefinition {
  name: string;
  description: string;
  /** JSON Schema object describing the function's arguments. */
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown> | unknown;
}

export interface RunToolLoopParams {
  model: string;
  systemPrompt: string;
  /** Conversation so far — typically just the user's question. The system
   *  prompt is prepended automatically, don't include it here. */
  messages: ChatMessage[];
  tools: ToolHandlerDefinition[];
  /** Hard cap on model turns that are allowed to request a tool call
   *  (default 5). One further forced turn is spent asking for a narrative
   *  answer if the model still wants a tool on the last one — 6 OpenAI
   *  calls in the worst case. */
  maxIterations?: number;
  /** Token budget for the final narrative answer. Intermediate turns (the
   *  model is only choosing a tool, not writing prose) use a fixed, much
   *  smaller budget regardless of this value. */
  maxTokens?: number;
  temperature?: number;
}

export interface RunToolLoopResult {
  ok: boolean;
  content: string;
  error?: string;
  rateLimited?: boolean;
  toolCalls: number;
  iterations: number;
}

const INTERMEDIATE_MAX_TOKENS = 400;
const DEFAULT_MAX_ITERATIONS = 5;
const DEFAULT_FINAL_MAX_TOKENS = 1200;

export async function runToolLoop(params: RunToolLoopParams): Promise<RunToolLoopResult> {
  const { model, systemPrompt, tools, temperature } = params;
  const maxIterations = params.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const finalMaxTokens = params.maxTokens ?? DEFAULT_FINAL_MAX_TOKENS;

  const toolDefs: ToolDefinition[] = tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
  const toolsByName = new Map(tools.map((t) => [t.name, t]));

  const conversation: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...params.messages];
  let totalToolCalls = 0;

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const isLastAllowedIteration = iteration === maxIterations;
    const result = await chatCompletion({
      model,
      messages: conversation,
      tools: toolDefs,
      temperature,
      maxTokens: isLastAllowedIteration ? finalMaxTokens : INTERMEDIATE_MAX_TOKENS,
    });

    if (!result.ok) {
      return { ok: false, content: '', error: result.error, rateLimited: result.rateLimited, toolCalls: totalToolCalls, iterations: iteration };
    }

    if (!result.toolCalls?.length) {
      // Model answered directly — done.
      return { ok: true, content: result.content, toolCalls: totalToolCalls, iterations: iteration };
    }

    if (isLastAllowedIteration) {
      // Out of tool-call budget: tell the model to stop and answer with
      // whatever it has, one forced final turn (the 6th call in the
      // maxIterations=5 default case) instead of looping forever.
      conversation.push({ role: 'assistant', content: result.content || null, tool_calls: result.toolCalls });
      for (const call of result.toolCalls) {
        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ error: 'Tool budget exhausted — answer with the data already gathered.' }),
        });
      }
      const finalResult = await chatCompletion({ model, messages: conversation, temperature, maxTokens: finalMaxTokens });
      return {
        ok: finalResult.ok,
        content: finalResult.ok ? finalResult.content : '',
        error: finalResult.ok ? undefined : finalResult.error,
        rateLimited: finalResult.rateLimited,
        toolCalls: totalToolCalls,
        iterations: iteration + 1,
      };
    }

    conversation.push({ role: 'assistant', content: result.content || null, tool_calls: result.toolCalls });
    for (const call of result.toolCalls) {
      totalToolCalls++;
      const tool = toolsByName.get(call.function.name);
      let outputStr: string;
      if (!tool) {
        outputStr = JSON.stringify({ error: `Unknown tool: ${call.function.name}` });
      } else {
        try {
          const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          const output = await tool.handler(args);
          outputStr = JSON.stringify(output ?? null);
        } catch (e) {
          outputStr = JSON.stringify({ error: (e as Error).message });
        }
      }
      conversation.push({ role: 'tool', tool_call_id: call.id, content: outputStr });
    }
  }

  // Unreachable — the loop always returns on its last iteration — but keeps
  // the function total and guards a misuse of maxIterations <= 0.
  return { ok: false, content: '', error: 'runToolLoop: maxIterations must be >= 1', toolCalls: totalToolCalls, iterations: 0 };
}
