# Mapa público do projeto

- Rota `/`: `apps/web/app/page.tsx` → `Workspace` (projetos, criação, galeria, assets, kits, configurações).
- Rota `/api/[...path]`: `apps/web/app/api/[...path]/route.ts` → `apps/web/lib/api.ts`.
- APIs: health, uploads, projects/events/transcript/cancel/retry, clips/versions/duplicate/propose/export/feedback, assets, brand-kits, media com Range.
- Store `useEditor`: `apps/web/lib/editor-store.ts` (EDL, histórico, revisão, undo/redo).
- UI `Button`: `apps/web/components/ui/button.tsx` (Radix Slot + variantes shadcn).
- UI `Editor` e `TimelineBlock`: `apps/web/components/`.
- Contrato `edlSchema`, `validateEdl`, `rebuildFromSegments`, `removeWord`, `native4k`: `packages/edl/index.ts`.
- Composição `ShortComposition`: `packages/composition/index.tsx`, usada por Player e render.
- Catálogo `effectCatalog`: gerado por `scripts/catalog.ts` a partir dos arquivos de efeitos.
- StorageAdapter/LocalStorage: `packages/core/storage.ts`.
- LLM estruturado e skill integral: `packages/core/llm.ts`.
- Worker de jobs: `apps/render-worker/src/index.ts`; render: `render.ts`.
- Worker de mídia: `apps/media-worker/main.py`; transcrição isolada: `transcribe.py`.
- Fila SQLite: `packages/core/queue.ts`; schema Drizzle: `packages/core/schema.ts`.
- Inicialização: `make dev` → `scripts/dev.ts`.

- Provedores LLM: `packages/core/llm-provider.ts` (Anthropic ou API compatível Qwen, somente servidor).
- Validação com fonte real: `scripts/ingest-video.ts` e `scripts/validate-project.ts`.
- Ingestão por link: `canonicalYoutubeUrl` em `packages/core/source-url.ts`, `POST /ingest-url` no worker Python; projetos exigem declaração de direitos.
- Correções auditadas de transcrição: `POST /api/projects/:id/transcript/corrections`, antes de criar cortes; preserva palavras/timestamps brutos.
- Entrada compacta da seleção: `timedSentences` em `packages/edl/sentences.ts`; alinhamento original continua sendo usado no planejamento.
