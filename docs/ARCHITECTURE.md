# Arquitetura

## Processos

`make dev` inicia Next.js (127.0.0.1:3000), FastAPI (127.0.0.1:8000) e o consumidor Node da fila SQLite. O orquestrador encerra os demais se algum serviço cair.

O banco é aberto por Drizzle sobre better-sqlite3 com WAL e busy timeout. `schema_migrations` registra a migração inicial. O modelo separa projetos, transcrições, cortes, versões, histórico, renders, assets, kits, jobs e feedback. Uma migração futura para Postgres exige substituir o driver e adaptar a definição de tabelas, mantendo as entidades.

## Fluxo

Upload → pasta de chunks → montagem atômica → projeto com declaração de direitos/hash da skill → job SQLite → ffprobe → proxy/áudio/voz → WhisperX isolado → cenas/rostos/energia → IA + skill → candidatos/validação → EDL + crop → preview → galeria → editor → versões → render solicitado → loudness de duas passadas → ffprobe → download.

O Node faz claim transacional e salva o progresso por etapa. Etapas pesadas de mídia retornam ao worker só quando concluídas. Cancelamento de render é ativo via cancel signal; cancelamento durante transcrição/análise é cooperativo no próximo limite de etapa. Erros não produzem arquivos finais parciais. Reprocessamento preserva os arquivos intermediários e os cortes já editados.

## Contrato EDL

`packages/edl/index.ts` valida o esquema da skill com campos adicionais opcionais para auditoria, estilo e âncoras. Tempos de fonte e saída são separados. `rebuildFromSegments` remapeia palavras após operações de montagem. Efeitos com `word_anchor` acompanham a palavra; efeitos sem âncora usam tempo de saída. Edições manuais deixam a preservação de sentido como pendente de revisão.

`packages/edl/config.ts` centraliza parâmetros principais. O worker Python lê os parâmetros compartilhados de suavização, silêncio e amostragem desse arquivo. Não há lógica de pontuação alternativa à skill no frontend.

## Preview e render

`ShortComposition` recebe EDL, mídia, faixas de voz e catálogo de assets. O Player e `@remotion/renderer` usam o mesmo componente. Coordenadas de desenho são 1080×1920 e o frame é escalado para cada preset. Isso preserva tamanho relativo de texto e efeitos em 540p/4K.

O render exporta H.264 CRF 18, AAC e faststart. A voz preparada usa a mesma fonte no Player e no renderer. Há pós-normalização do mix final, então loudness ouvido no Player não é uma garantia de identidade amostra a amostra. O pós-render valida vídeo/áudio, codec, tamanho, pixel format, color space e duração com tolerância de 2 frames.

## Adicionar efeito

Crie `packages/composition/effects/meu_efeito.tsx`, exportando `effect:EffectDefinition` com id, nome, categoria, schema Zod, defaults, render e descricao_para_IA. Componentes que importem APIs Remotion devem estar em arquivo com `use client` para que importações do catálogo pelas rotas Next não executem Remotion no contexto RSC. Execute `npm run catalog`; `make dev` já faz isso ao iniciar. Os catálogos do servidor, Player e renderer derivam da mesma lista. Reinicie o worker após adicionar arquivos.

Use somente parâmetros serializáveis. B-roll referencia `asset_id`, nunca URL arbitrária. Adicione fixtures e gere snapshots com `scripts/effect-snapshots.ts`. Snapshot renderizado sozinho não é uma comparação visual automática com baseline.

## Legendas e IA

Estilos de legenda vivem em `ShortComposition`; novos estilos precisam preservar margens mínimas e grupos de até três palavras. Fontes customizadas ainda não têm importação na UI.

`packages/core/llm.ts` carrega a skill integral, acrescenta contexto, divide a transcrição em janelas, guarda system prompt/respostas/usage, corrige JSON e audita sentido em segunda passada. Para outro provedor, mantenha a mesma função estruturada e os validadores Zod; não relaxe o contrato. O provedor de transcrição externo usa um contrato multipart separado.

## Superfície pública

Veja `.ai/project-manifesto.md` para componentes, API e stores exportados. O protótipo é de um só usuário local e não oferece autenticação remota.
