import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import OpenAI from 'openai';

const HOST = '127.0.0.1';
const PORT = Number.parseInt(process.env.AI_SERVER_PORT || '3001', 10) || 3001;
const MISSING_KEY_MESSAGE = 'OPENAI_API_KEY is missing. Set it in your environment or .env file.';

const SYSTEM_PROMPT = 'You are a chess endgame lesson editor working inside a local lesson-row editor. You only help with the currently active row. You improve lesson titles and lesson_text for a spreadsheet. The lesson_text must be CSV-safe: one continuous paragraph, no blank lines, no paragraph spacing, no Markdown, and no bullet points. Do not invent chess analysis. Use Stockfish/tablebase information as the source of truth when provided. If engine/tablebase information is missing, be cautious and state uncertainty in notes rather than making strong claims. Preserve chess notation, move numbers, FEN strings, and endgame terminology. Return valid structured JSON only.';

const LESSON_CHAT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assistant_message: {
      type: 'string',
      description: 'Normal chat reply shown to the user.',
    },
    suggested_title: {
      type: 'string',
      description: 'Optional improved title. Empty string if no title change is suggested.',
    },
    suggested_lesson_text: {
      type: 'string',
      description: 'Optional improved lesson text. Must be one paragraph with no blank lines. Empty string if no lesson text change is suggested.',
    },
    suggested_difficulty: {
      type: 'string',
      description: 'Optional difficulty suggestion. Empty string if no change is suggested.',
    },
    suggested_goal_type: {
      type: 'string',
      description: 'Optional goal type suggestion. Empty string if no change is suggested.',
    },
    notes: {
      type: 'string',
      description: 'Short notes explaining the suggestion.',
    },
    chess_concerns: {
      type: 'string',
      description: 'Chess accuracy concerns or verification notes.',
    },
    csv_warnings: {
      type: 'string',
      description: 'CSV formatting warnings, especially blank lines or paragraph breaks.',
    },
  },
  required: [
    'assistant_message',
    'suggested_title',
    'suggested_lesson_text',
    'suggested_difficulty',
    'suggested_goal_type',
    'notes',
    'chess_concerns',
    'csv_warnings',
  ],
};

const REQUIRED_AI_FIELDS = LESSON_CHAT_SCHEMA.required;

function stringValue(value) {
  return typeof value === 'string' ? value : String(value ?? '');
}

function trimmedString(value) {
  return stringValue(value).trim();
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isAllowedLocalOrigin(origin) {
  if (!origin) {
    return true;
  }
  try {
    const url = new URL(origin);
    return url.protocol === 'http:'
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

function sanitizeChatHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }
  return history
    .filter((entry) => isPlainObject(entry))
    .map((entry) => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: trimmedString(entry.content).slice(0, 4000),
    }))
    .filter((entry) => entry.content)
    .slice(-12);
}

function rowIsEmpty(body) {
  return [
    body.title,
    body.fen,
    body.difficulty,
    body.goal_type,
    body.lesson_text,
    body.status,
  ].every((value) => !trimmedString(value));
}

function buildUserPrompt(body) {
  const rowContext = {
    row_number: body.row_number ?? '',
    title: stringValue(body.title),
    fen: stringValue(body.fen),
    difficulty: stringValue(body.difficulty),
    goal_type: stringValue(body.goal_type),
    lesson_text: stringValue(body.lesson_text),
    status: stringValue(body.status),
    side_to_move: stringValue(body.side_to_move),
    best_move: stringValue(body.best_move),
    stockfish_summary: stringValue(body.stockfish_summary),
    tablebase_summary: stringValue(body.tablebase_summary),
  };

  return [
    'Current active lesson row:',
    JSON.stringify(rowContext, null, 2),
    '',
    `User chat message: ${stringValue(body.user_message)}`,
    '',
    'Respond conversationally in assistant_message and optionally provide suggested field updates for the active row only.',
    'Only suggest title, lesson_text, difficulty, or goal_type changes when useful.',
    'If you suggest lesson_text, keep it one continuous CSV-safe paragraph with no Markdown, no bullets, and no blank lines.',
  ].join('\n');
}

function parseStructuredOutput(response) {
  const outputText = response?.output_text;
  if (!outputText || typeof outputText !== 'string') {
    throw new Error('OpenAI returned no structured text output.');
  }
  let parsed = null;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error('OpenAI returned invalid JSON.');
  }
  if (!isPlainObject(parsed)) {
    throw new Error('OpenAI returned a non-object JSON response.');
  }
  REQUIRED_AI_FIELDS.forEach((field) => {
    if (typeof parsed[field] !== 'string') {
      throw new Error(`OpenAI response is missing ${field}.`);
    }
  });
  return parsed;
}

function errorPayload(message) {
  return { error: message };
}

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (isAllowedLocalOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Only localhost origins are allowed.'));
  },
}));

app.use(express.json({ limit: '256kb' }));

app.post('/api/lesson-chat', async (request, response) => {
  if (!process.env.OPENAI_API_KEY) {
    response.status(500).json(errorPayload(MISSING_KEY_MESSAGE));
    return;
  }

  const body = request.body;
  if (!isPlainObject(body)) {
    response.status(400).json(errorPayload('Malformed request body.'));
    return;
  }

  if (!trimmedString(body.user_message)) {
    response.status(400).json(errorPayload('Enter a chat message before sending.'));
    return;
  }

  if (rowIsEmpty(body)) {
    response.status(400).json(errorPayload('Current row is empty. Select a lesson row before using Local AI Lesson Chat.'));
    return;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const chatHistory = sanitizeChatHistory(body.chat_history);
  const input = [
    ...chatHistory.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    {
      role: 'user',
      content: buildUserPrompt(body),
    },
  ];

  try {
    const aiResponse = await client.responses.create({
      model: 'gpt-5.5',
      instructions: SYSTEM_PROMPT,
      input,
      store: false,
      reasoning: {
        effort: 'medium',
      },
      text: {
        format: {
          type: 'json_schema',
          name: 'lesson_chat_response',
          strict: true,
          schema: LESSON_CHAT_SCHEMA,
        },
      },
    });

    const parsed = parseStructuredOutput(aiResponse);
    response.json({
      ...parsed,
      previous_response_id: aiResponse.id || '',
    });
  } catch (error) {
    const message = error?.message || 'OpenAI API request failed.';
    const invalidFormat = message.startsWith('OpenAI returned') || message.includes('OpenAI response');
    response.status(502).json(errorPayload(invalidFormat
      ? `Invalid AI response format: ${message}`
      : `OpenAI API failure: ${message}`));
  }
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error?.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    response.status(400).json(errorPayload('Malformed request body.'));
    return;
  }
  response.status(500).json(errorPayload(error?.message || 'AI server failed.'));
});

app.listen(PORT, HOST, () => {
  console.log(`Local AI Lesson Chat server listening at http://localhost:${PORT}`);
});
