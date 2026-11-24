# n8n Automations (`@zeedan27`)

Curated, sanitized, import-ready **n8n workflow blueprints** maintained by [Zesrab Tanjeel Khan](https://github.com/zeedan27) ([zesrab.pages.dev](https://zesrab.pages.dev)). Every JSON workflow in this repository is scrubbed of `instanceId`, `webhookId`, `pinData`, credential IDs, and secret tokens before commit.

---

## Repository Taxonomy

| Folder | Focus |
|---|---|
| [`workflows/ai-research-and-rag/`](./workflows/ai-research-and-rag) | Academic paper digests, embeddings, and vector-store RAG pipelines |
| [`workflows/assistant-and-comms/`](./workflows/assistant-and-comms) | Telegram multimodal agents and human-in-the-loop email responders |
| [`workflows/document-and-data-ops/`](./workflows/document-and-data-ops) | Natural-language SQL querying and database operations |
| [`workflows/security-and-triage/`](./workflows/security-and-triage) | Phishing and suspicious email threat triage pipelines |
| [`scripts/`](./scripts) | Deterministic JSON sanitizer and pre-commit verification (`sanitize-workflow.mjs`) |

---

## Workflow Catalog

| Workflow | Category | Trigger & Core Stack | File |
|---|---|---|---|
| **Hugging Face Daily Papers to Notion** | AI Research & RAG | Schedule Trigger, HTTP Request, HTML Parser, OpenAI, Notion | [`hf-paper-digest-to-notion.json`](./workflows/ai-research-and-rag/hf-paper-digest-to-notion.json) |
| **Notion to Supabase Vector Store RAG** | AI Research & RAG | Notion Trigger, Token Splitter, OpenAI Embeddings, Supabase Vector Store | [`notion-supabase-vector-rag.json`](./workflows/ai-research-and-rag/notion-supabase-vector-rag.json) |
| **PostgreSQL Natural Language SQL Agent** | Document & Data Ops | Chat Trigger, LangChain Agent, OpenAI Chat, Postgres Tool, Window Memory | [`postgres-natural-language-agent.json`](./workflows/document-and-data-ops/postgres-natural-language-agent.json) |
| **Human-in-the-Loop Gmail RAG Autoresponder** | Assistant & Comms | IMAP Trigger, Qdrant Vector Store, Summarization Chain, Gmail Approval | [`hitl-gmail-triage-responder.json`](./workflows/assistant-and-comms/hitl-gmail-triage-responder.json) |
| **Telegram Multimodal AI Agent** | Assistant & Comms | Telegram Trigger, Text Classifier, OpenAI (Text/Audio/Image), Switch Router | [`telegram-multimodal-agent.json`](./workflows/assistant-and-comms/telegram-multimodal-agent.json) |
| **Suspicious Email Threat Analyzer** | Security & Triage | Gmail / Outlook Trigger, HTTP Request, Code IOC Parser, OpenAI, Jira | [`suspicious-email-analyzer.json`](./workflows/security-and-triage/suspicious-email-analyzer.json) |

---

## Adding New Workflows

1. **Import & sanitize** a raw n8n JSON export directly into a category folder:
   ```bash
   npm run sanitize -- --import raw-exports/my-flow.json workflows/ai-research-and-rag/my-flow.json --name "My Flow"
   ```
2. **Verify zero leaked credentials or instance IDs:**
   ```bash
   npm run check
   ```
3. **Commit and push** only clean, verified `.json` files (never commit `.env` or `raw-exports/`).

## Importing into n8n
1. Open your n8n instance → **Workflows → Import from File** and select any `.json` file under `workflows/`.
2. Bind your own n8n credentials where nodes show `<CONFIGURE_IN_N8N>` (reference variable names in [`.env.example`](./.env.example)).
