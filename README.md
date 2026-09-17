# Open Seldon

A visual analytics platform that transforms unstructured, multilingual Telegram data from refugee communities into actionable humanitarian intelligence.

## What it does

- Scrapes public Telegram channels using the Telegram API
- Translates multilingual messages to English via Claude
- Classifies messages into a humanitarian needs taxonomy (IOM categories)
- Extracts and geocodes locations mentioned in messages
- Stores structured data and semantic embeddings in PostgreSQL + pgvector
- Serves an interactive dashboard: map, category distribution, streaming chatbot, executive summary generator

## Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python, async) |
| Database | PostgreSQL 16 + pgvector |
| AI/LLM | Claude API (Anthropic) |
| NER / categorization | GLiNER2 (HuggingFace) |
| Embeddings | all-MiniLM-L6-v2 (sentence-transformers) |
| Geocoding | Nominatim (geopy) |
| Frontend | Next.js (TypeScript) |
| Infrastructure | Docker Compose |

## Getting started

### Prerequisites
- Docker and Docker Compose
- A `.env` file (copy from `.env.example` and fill in values)
- An Anthropic API key
- Telegram API credentials

### Run locally

```bash
cp .env.example .env
# fill in ANTHROPIC_API_KEY, TELEGRAM_API_ID, TELEGRAM_API_HASH, etc.
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

The API will be at `http://localhost:8000`, docs at `http://localhost:8000/docs`, and the web app at `http://localhost:3000`.

### Run the pipeline

```bash
# Scrape a Telegram channel
docker compose exec api python -m pipeline.scraper --channel polska_grupa_informacyjna

# Process scraped messages (translate, categorize, geocode, embed)
docker compose exec api python -m pipeline.processor --all
```

## Project structure

```
api/           FastAPI backend + processing pipeline
web/           Next.js frontend
scripts/       Database init, utility scripts
.github/       CI workflows
```

## Contributing

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Issues and pull requests welcome.

## License

MIT — see [LICENSE](LICENSE).
