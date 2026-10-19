# Evidências e limites da entrega

Este repositório implementa um protótipo local substancial. **Os sete marcos originais não estão integralmente homologados.** Não há alegação de benchmark de 20 min em menos de 15 min.

## Validação em andamento em 19/10/2026

- 50 testes Vitest, quatro testes Python e TypeScript passaram.
- Integração Qwen compatível com OpenAI configurada no servidor; chamada real e seleção com EDL sintética aprovadas.
- Vídeo autorizado `nq5NKs5DDlE`: ingestão real de 1080p, proxy, 2625 palavras alinhadas com WhisperX large-v3 e análise de 3443 frames concluídas.
- Nomes próprios da introdução corrigidos com registro de antes/depois, preservando os arquivos brutos.
- Seleção real e exportação dos cinco cortes ainda em validação. Evidências em `storage/evidence/youtube-nq5NKs5DDlE/`.
- Entrada por link público YouTube implementada com restrição de host/ID e declaração de direitos. O teste atual usou download público e upload por chunks; a rota de link ainda não tem homologação integral.
- Retry automático com backoff persistente foi implementado e testado; resultados abaixo registram o estado da execução anterior.

## Executado em 18/10/2026

- TypeScript: `npm run typecheck` passou.
- Contratos e API: 33 testes Vitest passaram, cobrindo EDL, notas, tempos, edição, assets, upload por chunks, declaração de direitos, fila persistida, cancelamento/retry, proteção de origem, versões e A/B.
- Python: 2 testes de suavização de crop passaram.
- Next.js 15: build de produção compilou e gerou as rotas `/` e `/api/[...path]`.
- `npm run dev`: app, worker Node e FastAPI iniciaram juntos, sem Docker e sem Redis.
- API real local: health, probe, prepare e analyze executados com vídeo sintético.
- Render real Remotion: fonte sintética 1280×720/16 s → 1080×1920/30 fps/H.264 High/AAC. 480 frames de vídeo. Container 16,042 s, diferença de 0,042 s, abaixo de 2 frames.
- Correção de cor: segunda execução passou em yuv420p, faixa tv e bt709.
- Medição pós-render: −14,05 LUFS; true peak −12,89 dBTP na amostra senoidal.
- 17 frames de referência de efeitos foram renderizados em `docs/evidence/effects/`. B-roll requer fixture de asset licenciado e não foi exercitado no teste inicial.
- UI inicial verificada no navegador: `docs/evidence/projects.png`.

O vídeo sintético não contém fala. Sua transcrição/EDL conhecida servem apenas como fixtures de render e editor. Não validam qualidade de alinhamento WhisperX nem escolha narrativa.

## Cobertura por marco

| Marco | Implementação presente                                                                                       | Falta para homologação completa                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| M1    | Monorepo, EDL, SQLite, upload retomável, probe/proxy, fila, SSE                                              | Teste de upload real de 4 GB, ingresso por URL, retry automático com backoff                                    |
| M2    | WhisperX isolado, provedor externo, cenas/silêncios/rostos/energia/crop                                      | Transcrição de fala real, erro ≤80 ms e diarização não homologados                                              |
| M3    | Skill integral, LLM estruturado, reparo, auditoria, filtros, notas e galeria                                 | Sem chave Anthropic disponível: seleção real e qualidade editorial não executadas                               |
| M4    | Composição compartilhada, Player, legendas, crop, render real e loudness                                     | Comparação automatizada de frames Player vs MP4 e fonte humana com vários locutores                             |
| M5    | Timeline de seis trilhas, arrastar/trim, palavras, edição de legendas, efeitos, áudio, histórico persistente | Freeze/speed ramp, seleção de intervalo da transcrição, fonte/sombra/animação completas e loop de trecho        |
| M6    | Propostas com revisão, A/B de gancho, presets, verificação 4K, kits básicos                                  | Diff por campo de toda EDL, kits com logo/intro/outro, render 4K real e calibração com ≥30 feedbacks            |
| M7    | Testes, smoke, README, decisões, arquitetura e inventário de licenças                                        | Pipeline integral de 5 min com fala/IA, benchmark de 20 min, teste visual automático e auditoria completa de UX |

## Limitações operacionais

- Um projeto por vez na fila; concorrência configurável apenas no renderer. Falhas transitórias recebem retry com backoff persistente; o botão Reprocessar também permite nova tentativa. Recuperação após reiniciar retorna jobs interrompidos à fila.
- Transcrição/análise bloqueantes no Python só observam cancelamento ao retornar à próxima etapa. O render pode ser cancelado durante os frames.
- Locutor ativo é uma heurística com energia/movimento facial/diarização; não é um classificador audiovisual validado. Tela dividida usa duas zonas fixas.
- O declick aplica rampas de áudio de 45 ms nas bordas. Não há busca explícita de zero-crossing nem crossfade sobreposto entre segmentos.
- Ducking reage à presença de palavras alinhadas; não há envelope de ataque/release calibrado em fala real.
- A composição roda a 30 fps. Fonte até 60 fps não muda o fps de exportação nesta versão. Aceleração de encode por hardware/H.265 não habilitadas.
- O crop da fonte define a checagem básica de 4K; zooms extremos podem reduzir a resolução nativa efetiva. Ampliação exige confirmação.
- Fonte padrão usa Arial do sistema; não são distribuídos arquivos de fontes. Fontes e brand kits completos ainda não têm gerenciamento de arquivos na UI.
- Configurações são editadas no `.env`, com status visível na interface. Não há gravação de chaves pela UI.
- Rastro do LLM contém usage, prompt e respostas; não há somatório de custo monetário na interface nem calibração automática.
- O endpoint de feedback existe, mas não há importador dedicado de curvas na UI.
- Conteúdo e sentido ainda exigem revisão humana, principalmente após reordenação, cold open e textos de gancho.
- Não é serviço multiusuário. Não exponha os processos fora de loopback.
