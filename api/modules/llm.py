"""
Shared OpenRouter client and model constants.

All LLM calls route through OpenRouter so we can mix models
(Gemini Flash for cheap pipeline work, Claude Sonnet for chatbot/summaries)
under a single API key and billing limit.
"""
import os
from openai import AsyncOpenAI

# High-volume pipeline tasks: translation, categorization, NER, vision
PIPELINE_MODEL = "google/gemini-1.5-flash"

# Low-volume user-facing tasks: chatbot, executive summary
CHAT_MODEL = "anthropic/claude-3.5-sonnet"


def openrouter_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ["OPENROUTER_API_KEY"],
        default_headers={
            "HTTP-Referer": "https://github.com/oliviacroteau667/open-seldon",
            "X-Title": "Open Seldon",
        },
    )
