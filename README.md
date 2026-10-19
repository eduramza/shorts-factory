# ClipForge · protótipo local

Estúdio de cortes verticais em português. Next.js 15, Remotion, SQLite/Drizzle e dois workers locais. **Não usa Docker nem Redis**, conforme a orientação posterior ao prompt original.

## Rodar

Requisitos: Node.js 22+, Python 3.11 ou 3.12, `make`, `ffmpeg` e `ffprobe` no PATH. No macOS: `brew install ffmpeg python@3.12` se necessário.

```sh
make dev
```

Na primeira execução, o comando instala dependências npm e cria `.venv` (mídia) e `.venv-whisper` (transcrição). A instalação inicial pode ocupar vários GB. Abra http://127.0.0.1:3000. Ctrl+C encerra app e workers. Para usar Python 3.11: `make dev PYTHON=python3.11`.

O arquivo `.env` é criado a partir de `.env.example`. Para a seleção automática, configure `ANTHROPIC_API_KEY` e um `LLM_MODEL` disponível na sua conta e reinicie. Também há suporte a APIs compatíveis com OpenAI: `LLM_PROVIDER=openai-compatible`, `LLM_BASE_URL`, `LLM_API_KEY` (ou `QWEN_API_KEY`) e `LLM_MODEL`. A integração Qwen foi exercitada com `qwen3.8-flash`. O valor inicial solicitado no prompt é `claude-sonnet-5-5`; disponibilidade não foi verificada com uma conta Anthropic. Nunca coloque a chave em variáveis `NEXT_PUBLIC_*`.

WhisperX baixa os modelos na primeira transcrição. `WHISPER_MODEL=large-v3` é o padrão pedido; CPU é usada no Apple Silicon porque faster-whisper/CTranslate2 não usa Metal. Para testar com menos recursos, configure explicitamente um modelo menor. Não há seleção falsa de IA quando a chave falta: o projeto informa o erro e permite reprocessar.

Para transcrição externa, use `TRANSCRIPTION_PROVIDER=external`, `EXTERNAL_TRANSCRIPTION_URL` e `EXTERNAL_TRANSCRIPTION_KEY`. O endpoint deve aceitar multipart e responder `{words:[{start,end,word}], language}`. Nesse modo, **o áudio sai do computador**. No modo padrão, apenas transcrição e metadados da montagem são enviados ao provedor de IA configurado. `LLM_ENABLED=false` bloqueia chamadas à IA.

## O que funciona

- Projetos locais, direitos registrados, upload por chunks de 8 MB com retomada, limite de 4 GB. Links públicos do YouTube com declaração de propriedade/licença usam yt-dlp; quando o download não está disponível, use o arquivo local autorizado.
- Fila persistente SQLite, progresso SSE, cancelar, reprocessar e recuperar tarefas após reinício.
- ffprobe, proxy 720p, áudio mono 16 kHz, voz normalizada e versão com redução de ruído.
- WhisperX com alinhamento por palavra em processo isolado; diarização opcional com `HF_TOKEN` e permissões dos modelos.
- Cenas, silêncios, energia, rostos a 5 fps, crop suavizado e heurística de locutor.
- Skill integral no system prompt, hash por projeto, seleção em janelas sobrepostas, auditoria de chamadas, revisão de sentido, correção de JSON e validação determinística.
- Galeria, notas por critério, estrutura narrativa, estimativa de retenção e QA.
- Remotion Player e render usando `ShortComposition`; export 540p, 1080p e 4K com confirmação de ampliação.
- Editor por transcrição, divisão em palavra, reordenação, trim/movimento na timeline, efeitos, legendas, crop, música/SFX e ducking.
- Histórico e desfazer/refazer persistidos em SQLite, versões nomeadas, autosave, A/B apenas do texto do gancho.
- Propostas de IA aceitas ou descartadas, biblioteca com licença obrigatória, brand kits de cor/legenda.

Não considere todos os critérios do prompt homologados. Veja [limitações e cobertura](docs/STATUS.md).

## Verificar

```sh
make test
make smoke
npm run build
```

Teste real de render (com `make dev` já iniciado):

```sh
ffmpeg -y -f lavfi -i testsrc2=size=1280x720:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 16 -c:v libx264 -preset ultrafast -c:a aac storage/sources/fixture.mp4
node --import tsx scripts/render-smoke.ts
node --import tsx scripts/effect-snapshots.ts
```

O script de render cria um projeto **explicitamente sintético**, com EDL conhecida e sem IA, para testar a exportação. Não é prova de seleção ou transcrição automática. Saída: `storage/renders/smoke-1080p.mp4`. Nunca use as notas dessa fixture como análise de um vídeo real.

## Dados e manutenção

`storage/clipforge.sqlite` contém projetos, EDLs, versões, tarefas e assets. Mídias, transcrições e rastros de LLM ficam em `storage/`. Faça backup da pasta com os processos parados. Chaves ficam no `.env`, fora do banco e do navegador. O serviço escuta apenas em loopback; não exponha o protótipo na internet.

O arquivo original da skill continua em `skill-retention-shorts/SKILL.md`; a cópia usada pela aplicação é `skills/retention-shorts/SKILL.md`, byte a byte.

[Arquitetura](docs/ARCHITECTURE.md) · [Decisões](docs/DECISIONS.md) · [Validação](docs/STATUS.md) · [Licenças](docs/LICENSES.md) · [Assets](assets/ATTRIBUTION.md)
