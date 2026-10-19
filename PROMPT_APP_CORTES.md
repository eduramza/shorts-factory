# PROMPT: App web de cortes verticais com foco em retenção ("ClipForge", nome provisório)

Você é um engenheiro full-stack sênior. Construa o MVP descrito abaixo, completo e funcional, rodando localmente com um comando. Antes de codar, leia `skills/retention-shorts/SKILL.md` (anexa a este prompt). Ela é a **fonte de verdade da lógica de seleção e edição** e deve ser usada como parte do system prompt da IA. Não reescreva nem simplifique as regras dela. Se algo na skill for ambíguo, siga a skill e registre a dúvida em `docs/DECISIONS.md`.

Idioma da interface: **português do Brasil**. Código e comentários em inglês.

---

## 1. Objetivo

O usuário envia (ou cola um link próprio de) um vídeo longo (podcast, aula, live, entrevista). O sistema devolve **N cortes verticais 9:16 prontos para postar**, escolhidos e montados pela IA segundo a técnica Hook → Storytelling → Payoff, e permite **editar cada corte** (texto, cortes, legendas, efeitos, música) com pré-visualização fiel ao render final.

Diferenciais obrigatórios sobre ferramentas como o OpusClip:
1. **Transparência**: nota por critério (hook, tensão, payoff…) com justificativa, e previsão de retenção com pontos de risco, rotulada como estimativa.
2. **Edição não destrutiva**: todo corte é uma EDL em JSON (esquema da skill). O editor altera o JSON, e o preview e o render leem o mesmo JSON.
3. **Cold open / reordenação de gancho** sem alterar o sentido da fala.
4. **Variações A/B** de gancho em texto.
5. **Catálogo de efeitos** editável e extensível (seção 7).
6. **Qualidade de exportação** configurável (1080p padrão, 4K quando a fonte permitir).

Fora do escopo do MVP: publicação automática nas redes, contas multiusuário, pagamento, app mobile, vídeo gerado por IA.

---

## 2. Stack (use exatamente, salvo bloqueio técnico documentado)

- **Frontend/API**: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui. Estado com Zustand. Validação com Zod.
- **Preview e render**: **Remotion** (`@remotion/player` no editor, `@remotion/renderer` no worker). **Uma única composição** `ShortComposition` recebe a EDL e é usada tanto no preview quanto no render. Isso garante que o preview seja idêntico ao arquivo final.
- **Worker de mídia (Python 3.11)**: FastAPI + ffmpeg: extração de áudio, transcrição, detecção de cena/silêncio, rastreamento de rosto e cálculo do caminho de crop.
  - Transcrição: **WhisperX** (faster-whisper `large-v3`, com alinhamento por palavra e diarização opcional). Fallback configurável para API externa.
  - Rosto/locutor ativo: MediaPipe Face Detection (MVP) e heurística de locutor ativo por energia de áudio + diarização.
  - Cenas: PySceneDetect.
- **Fila**: Redis + BullMQ (Node). Jobs com progresso por etapa, retry, cancelamento.
- **Banco**: SQLite via Drizzle (MVP), com migrations. Esquema pensado para migrar a Postgres.
- **Armazenamento**: pasta local `storage/` com interface `StorageAdapter` (permite trocar por S3/R2).
- **IA de decisão**: Claude via API Anthropic, com saída estruturada validada por Zod. Modelo configurável em `.env` (`LLM_MODEL`, padrão `claude-sonnet-5-5`). O system prompt é o conteúdo de `SKILL.md`.
- **Orquestração local**: `docker compose up` sobe Redis, worker Python e app. Também deve haver `make dev` sem Docker.

Estrutura de pastas:

```
/apps/web            Next.js (UI + API routes)
/apps/render-worker  Node: BullMQ + Remotion renderer + chamadas ao LLM
/apps/media-worker   Python FastAPI: transcrição, cenas, rosto, áudio
/packages/edl        Tipos Zod do EDL + utilitários (validação, conversão de tempos)
/packages/composition Composição Remotion (ShortComposition, efeitos, legendas)
/skills/retention-shorts/SKILL.md
/assets/music /assets/sfx /assets/fonts /assets/stickers   (apenas conteúdo com licença livre; documente a fonte em ATTRIBUTION.md)
/docs
```

---

## 3. Pipeline (job `project.process`)

Etapas com status e progresso (0–100) persistidos e exibidos na UI em tempo real (SSE):

1. **ingest**: upload (até 4 GB, upload resumível por chunks) **ou** URL. Ver seção de conformidade (9). Gerar proxy 720p para a interface e manter o original para o render.
2. **probe**: ffprobe (duração, fps, resolução, codec, áudio). Rejeitar arquivos corrompidos com mensagem clara.
3. **audio**: extrair áudio mono 16 kHz para transcrição e medir loudness.
4. **transcribe**: WhisperX com timestamp por palavra, idioma automático (pt-BR prioritário), diarização opcional. Salvar JSON bruto.
5. **analyze**: cenas, silêncios, trechos de fala por locutor, rostos por frame (amostragem 5 fps), energia de áudio.
6. **select**: chamar o LLM com a transcrição segmentada (chunks com sobreposição para vídeos longos) e a skill → candidatos pontuados → filtros da skill → top N (padrão 5, máx. 15). Registrar prompt, resposta e versão da skill por corte (auditoria).
7. **plan**: para cada corte escolhido, gerar a EDL completa (segmentos, cold open, remoções, reenquadramento, legendas, efeitos, áudio, previsão de retenção, QA).
8. **reframe**: calcular o caminho de crop 9:16 com suavização (filtro de Kalman ou spline + limite de velocidade), tratando 0, 1 e 2+ rostos (alternância por locutor ativo, com opção de tela dividida). Fallback: centro.
9. **render preview**: gerar um preview leve (540×960) de cada corte para a galeria.
10. **render final** (sob demanda): export em alta qualidade (seção 8).

Todas as etapas são idempotentes e retomáveis (cache por hash do arquivo + parâmetros). Se o LLM devolver JSON inválido: validar com Zod, reenviar o erro ao modelo (até 2 tentativas) e só então marcar o corte como falho, sem derrubar os demais.

---

## 4. Integração com a skill (regras obrigatórias)

- O system prompt do LLM = `SKILL.md` + um bloco de contexto com: modo de duração (`viral|balanced|authority`), nº de cortes pedidos, idioma, nicho/tom opcional do usuário, lista de efeitos e músicas **disponíveis no catálogo** (IDs reais).
- A IA só pode referenciar IDs de música, SFX e efeitos que existam no catálogo. Valide e rejeite IDs inexistentes.
- Aplicar **validadores determinísticos em código** (não confiar só no LLM) para as regras verificáveis da skill:
  - duração dentro do modo;
  - nenhum trecho > 4 s sem mudança visual (contar efeitos, cortes e trocas de enquadramento);
  - cortes só em limites de palavra, com crossfade de áudio;
  - legendas ≤ 3 palavras por vez e dentro da área segura;
  - ducking presente quando há música;
  - hook nos primeiros 3 s e payoff nos últimos 3–5 s;
  - hook < 12/25 ou payoff < 8/20 descarta o candidato.
- Se a validação falhar, tentar auto-correção (ex.: inserir zoom para quebrar 4 s parados) e registrar o ajuste em `qa.violations` com `auto_fixed: true`.
- Versionar a skill: gravar em cada projeto o hash do `SKILL.md` usado.

---

## 5. Modelo de dados (mínimo)

- `projects(id, title, source_path, source_meta_json, language, mode, status, created_at)`
- `transcripts(project_id, json_path, language, diarized)`
- `clips(id, project_id, rank, score_total, scores_json, edl_json, status, preview_path, skill_hash, llm_trace_json, created_at, updated_at)`
- `clip_versions(id, clip_id, edl_json, label, created_at)`: histórico de edições com desfazer/refazer persistente.
- `renders(id, clip_id, preset, status, path, size_bytes, created_at)`
- `assets(id, type[music|sfx|font|sticker|brand], name, path, license, source_url, mood, bpm, duration)`
- `brand_kits(id, name, colors_json, font_ids, caption_style_json, logo_path, watermark_json, intro_outro_json)`
- `jobs(id, project_id, type, status, progress, error, started_at, finished_at)`
- `retention_feedback(clip_id, platform, curve_json, views, imported_at)`: para calibração futura (seção 10 da skill).

---

## 6. Telas

1. **Projetos**: lista, criar novo, status.
2. **Novo projeto**: upload/URL, checkbox obrigatório de direitos ("Declaro que tenho os direitos ou licença para usar este conteúdo"), modo (viral/balanced/authority), nº de cortes, idioma, brand kit, nicho/tom (campo livre).
3. **Processamento**: etapas com progresso em tempo real, log amigável, cancelar.
4. **Galeria de cortes**: cards com preview vertical, nota total, duração, selo do gancho (nativo/cold open), botões Editar / Exportar / Duplicar (A/B).
5. **Detalhe do corte (diferencial)**: nota por critério com justificativas, linha do tempo Hook/Beats/Payoff colorida, curva de retenção prevista com pontos de risco clicáveis (pula para o instante), violações de QA e correções automáticas.
6. **Editor** (principal):
   - Player Remotion central (9:16), play/pause, frame a frame, loop de trecho.
   - **Timeline multitrilha**: vídeo, legendas, efeitos, texto, música, SFX. Arrastar, redimensionar, dividir, apagar, snap em limites de palavra.
   - **Edição por transcrição**: clicar/selecionar palavras e apagar (remove o trecho do vídeo), reordenar blocos.
   - **Painel de legendas**: editar texto palavra a palavra, estilo (fonte, cor, contorno, sombra, destaque da palavra ativa, animação), posição e área segura visível (overlay opcional).
   - **Painel de enquadramento**: ver o crop, ajustar keyframes manualmente, escolher modo (auto rosto, tela dividida, centro, manual).
   - **Painel de efeitos**: catálogo (seção 7) com prévia, parâmetros e adicionar na posição do cursor.
   - **Painel de áudio**: música (trocar faixa, volume, ducking, fade), SFX, normalização da voz, remover ruído.
   - **Gancho**: mostra as 3 opções de texto de abertura da IA e permite escolher ou editar. Botão "Regenerar gancho" (chama a IA só para essa parte, respeitando a skill).
   - **Ações de IA**: "Encurtar para X s", "Aumentar tensão", "Trocar gancho", "Refazer só o final". Cada ação retorna uma EDL nova **como proposta** (diff visual) que o usuário aceita ou descarta.
   - Desfazer/refazer ilimitado, versões nomeadas, autosave.
   - Atalhos: espaço (play), J/K/L, S (dividir), Delete, Ctrl+Z/Shift+Ctrl+Z.
7. **Exportar**: presets, fila de render com progresso, download, copiar legenda/título sugerido.
8. **Biblioteca de assets**: músicas, SFX, fontes, stickers, com filtro por mood/BPM e campo obrigatório de licença/fonte.
9. **Brand kits**: criar/editar.
10. **Configurações**: chaves de API, modelo do LLM, qualidade padrão, pasta de armazenamento, limites de recurso.

Requisitos de UX: responsivo desktop (prioridade), estados de carregamento/erro/vazio em todas as telas, mensagens de erro acionáveis, tema claro/escuro, acessibilidade básica (foco, contraste, rótulos).

---

## 7. Catálogo de efeitos (implementar como componentes Remotion parametrizáveis)

Cada efeito tem: `id`, `nome`, `categoria`, `schema` Zod de parâmetros, valores padrão, `render()` e uma `descricao_para_IA` curta (usada no contexto do LLM).

**Câmera/enquadramento**: `zoom_punch` (105–115%, ease-out rápido), `zoom_slow` (100→108%), `pan_suave`, `shake` (curto, intensidade configurável), `speed_ramp` (aceleração/desaceleração), `freeze_frame`.
**Transição/impacto**: `flash` (branco, 2–4 frames), `glitch`, `whip_pan`, `blur_in/out`, `fade`.
**Texto**: `overlay_text` (título de gancho, call-out, "lower third"), animações de entrada/saída (pop, slide, typewriter), `emphasis_word` (destaque pontual).
**Legendas**: estilos prontos (limpo, palavra ativa colorida, caixa, contorno grosso, karaokê), animação por palavra, emoji automático opcional.
**Apoio visual**: `broll_image/video` (do banco local ou upload do usuário), `sticker`, `arrow/circle_highlight`, `progress_bar`, `countdown`.
**Áudio**: `sfx_whoosh`, `sfx_hit`, `sfx_riser`, `music_swap`, `ducking`.

Regras:
- Efeitos operam por **tempo** (`t0`,`t1`) e/ou **âncora de palavra** (grudados em uma palavra da transcrição, sobrevivem a edições de corte).
- Extensível: adicionar um efeito = criar um arquivo em `packages/composition/effects/` exportando o contrato acima. O catálogo é descoberto automaticamente.
- Todo efeito deve funcionar igual no preview e no render (testar com snapshot visual).

---

## 8. Render e qualidade

Presets de exportação:
- **Padrão 1080×1920**, 30 fps (ou fps da fonte até 60), H.264 High, CRF 18, `yuv420p`, `+faststart`, áudio AAC 256 kbps, loudness -14 LUFS (pico real ≤ -1 dBTP).
- **Alta 2160×3840** (4K vertical): disponível **somente** se o crop da fonte tiver pixels nativos suficientes. Calcule o tamanho real do recorte; se for insuficiente, exiba aviso claro ("a fonte não tem resolução para 4K nativo; o resultado seria ampliado") e permita exportar assim mesmo marcando como "ampliado". H.265 opcional.
- **Rascunho 540×960** rápido.
- Aceleração por hardware quando disponível (VideoToolbox no macOS, NVENC no Windows/Linux) com fallback por software.
- Concorrência configurável. Progresso real por frame. Cancelável. Sem arquivos órfãos em caso de falha.
- Espaço de cor correto (Rec.709), sem cortes de preto/branco, sem banding visível em gradientes; validar com amostras.

Pós-render automático: verificar com ffprobe (duração, resolução, codec, áudio presente) e comparar a duração com a EDL (tolerância ≤ 2 frames). Falhar com erro explícito se divergir.

---

## 9. Conformidade, segurança e privacidade

- Aceitar apenas conteúdo que o usuário declare possuir ou ter licença. Checkbox obrigatório, registrado com data e usuário. Em URLs, permitir apenas fontes que o usuário confirme como suas; **não** incluir recursos para contornar proteções ou DRM.
- Assets de música/SFX/stickers: somente com licença registrada. **Não incluir faixas de origem duvidosa** (ex.: músicas retiradas de vídeos do YouTube). Pasta `assets/` deve vir com instruções e exemplos de fontes livres (ex.: bibliotecas de licença livre), e o app deve bloquear o uso de asset sem campo de licença.
- A IA não pode inventar falas nem alterar o sentido do que foi dito. Validar que o texto de legenda de cada palavra corresponde à transcrição (diff) e que `overlay_text` de gancho não afirma fatos ausentes (checagem pelo LLM em segunda passada, marcada como "revisar" quando duvidosa).
- Chaves de API só no servidor (`.env`), nunca no cliente. Sanitizar nomes de arquivo, limitar tipos MIME e tamanho, executar ffmpeg sem shell (args em array), isolar caminhos (sem path traversal).
- Dados do usuário ficam locais por padrão. Mostrar claramente o que é enviado a APIs externas (transcrição de texto para o LLM) e permitir desativar/trocar o provedor.

---

## 10. Observabilidade e testes

- Logs estruturados por job, com `project_id`/`clip_id`. Tela de diagnóstico mostrando tempo por etapa e custo estimado de LLM por projeto.
- Testes unitários: validadores da skill, conversão de tempos, aplicação de EDL (cortes/remoções), suavização do crop.
- Testes de integração: um vídeo de exemplo curto (5 min, domínio livre ou gerado) passa pelo pipeline inteiro e gera ≥ 1 corte válido.
- Teste visual do Remotion: snapshots de frames-chave de cada efeito.
- Testes de contrato: EDL gerada pelo LLM é sempre validada pelo Zod; casos de JSON inválido e IDs inexistentes.
- Script `scripts/smoke.sh` que roda tudo localmente e imprime um relatório.

---

## 11. Critérios de aceite do MVP (todos obrigatórios)

1. Um vídeo de 20 min em pt-BR vira ≥ 5 cortes em **menos de 15 min** em um Mac com Apple Silicon (sem GPU dedicada), com progresso visível.
2. Cada corte tem: gancho nos primeiros 3 s (nativo ou cold open), pelo menos 1 beat de tensão, payoff nos últimos 3–5 s, duração dentro do modo, nota por critério com justificativa.
3. Nenhum corte começa ou termina no meio de uma palavra. Áudio sem estalos.
4. O reenquadramento 9:16 mantém o rosto do locutor ativo centralizado e sem tremor visível. Em vídeos com 2 pessoas, alterna sem "saltos" bruscos.
5. Legendas palavra a palavra sincronizadas (erro ≤ 80 ms), dentro da área segura.
6. O editor permite: apagar trechos pela transcrição, editar legendas, adicionar/remover/mover efeitos, trocar música, trocar o gancho, desfazer/refazer, e o preview coincide com o arquivo exportado (comparar frames-chave: diferença imperceptível).
7. Export 1080×1920 correto (validado por ffprobe) e loudness -14 LUFS (± 1).
8. Export 4K só habilitado conforme a regra de pixels nativos, com aviso quando ampliado.
9. Validadores da seção 4 passam em todos os cortes entregues (ou o corte aparece marcado com as violações).
10. Variações A/B de gancho geram EDLs distintas, diferindo apenas na variável declarada.
11. `docker compose up` e `make dev` funcionam a partir de um clone limpo, com README passo a passo (incluindo `.env.example`).

---

## 12. Plano de entrega (siga a ordem e demonstre cada marco)

**M1**: Monorepo, `packages/edl`, upload, ffprobe, proxy, fila e tela de processamento.
**M2**: Transcrição WhisperX + análise (cenas, silêncios, rosto) + visualização da transcrição.
**M3**: Integração LLM com a skill, EDL válida, validadores, galeria de cortes com notas (ainda sem render sofisticado).
**M4**: `ShortComposition` + Remotion Player + reenquadramento + legendas dinâmicas + render 1080p.
**M5**: Editor completo (timeline, edição por transcrição, painéis, versões) + catálogo de efeitos + música/SFX/ducking.
**M6**: Ações de IA com propostas (diff), A/B de gancho, presets de export, 4K condicional, brand kits.
**M7**: Testes, documentação, polimento, relatório final de limitações conhecidas.

Ao final de cada marco: rode os testes, mostre evidências (capturas, logs, arquivos de saída) e liste o que ficou pendente. **Não declare algo concluído sem executar e verificar.** Se algo não puder ser feito como especificado, explique o motivo e proponha alternativa, sem trocar silenciosamente.

---

## 13. Restrições gerais

- Não use dependências sem licença permissiva compatível. Liste todas em `docs/LICENSES.md` (atenção: modelos de transcrição, fontes, músicas).
- Não otimize cedo: priorize **correção e qualidade do vídeo final**.
- Todo número mágico (limiares de silêncio, velocidades, ganhos) em um arquivo de configuração único (`packages/edl/config.ts`), alinhado com os parâmetros da skill, para calibração posterior.
- Documente em `docs/ARCHITECTURE.md` o fluxo de dados e como adicionar efeitos, estilos de legenda e provedores de IA.
