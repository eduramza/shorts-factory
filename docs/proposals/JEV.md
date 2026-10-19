# Proposta: Jev no ClipForge

Status: análise técnica; nenhuma integração, instalação ou chamada TypeSafe executada. Consulta: 19/10/2026. O teste de cortes já iniciado com Qwen continua independente desta proposta.

## Recomendação

Adotar Jev como avaliador de decisões delimitadas, começando por triagem e auditoria editorial em modo de comparação. Manter código local responsável pelos cálculos e um modelo generativo responsável pelos textos novos. Só substituir a avaliação atual depois de medir qualidade, custo e latência em português.

A API pode ser chamada diretamente pelo worker Node. Não precisamos adicionar Chrome, Browser Harness, Docker ou Redis ao processamento dos vídeos. O repositório `jev-ultrafast` serve como referência de arquitetura; o SDK TypeSafe é o ponto de integração mais adequado ao produto.

## O que foi analisado

O [repositório jev-ultrafast](https://github.com/browser-use/jev-ultrafast) implementa um agente de navegador. `snapshot.js` cria uma observação compacta dos controles visíveis; `model.py` oferece operações e alvos válidos ao Jev; `agent.py` verifica o estado antes de executar e reaproveita texto gerado quando a entrada não mudou. Um segundo modelo escreve o conteúdo dos campos. Essa divisão entre observar, escolher, gerar e validar pode orientar nosso pipeline.

O [Jev da TypeSafe](https://docs.typesafe.ai/introduction) avalia estado e perguntas tipadas: Choice escolhe opções, Score avalia rubricas e Noul estima uma resposta sim/não. As perguntas podem compartilhar uma requisição. O [console](https://console.typesafe.ai/home) é a interface da conta e exige login, não é o endpoint de inferência. Não acessei uma conta.

A [API](https://docs.typesafe.ai/api) usa `POST https://api.typesafe.ai/v1/systemone`, com `model`, `state` e `questions`. Há [SDK oficial TypeScript](https://docs.typesafe.ai/sdk/javascript), compatível com nosso Node 22. A API não é uma substituição direta de `/chat/completions`.

## Diagnóstico da implementação atual

- `packages/core/llm.ts`: o LLM propõe candidatos com tempos e notas, gera EDL completa e depois audita a montagem. Respostas inválidas retornam ao mesmo modelo, com histórico crescente.
- Os rastros preservados do Flash contêm nove chamadas de planejamento, cinco de reparo, totalizando 75.090 tokens de entrada e 16.840 de saída nessa amostra. São arquivos parciais de uma execução interrompida; não representam a fatura nem um benchmark completo.
- A compactação da transcrição para frases já reduziu uma chamada observada de 88.383 para 11.397 tokens de entrada. A diferença inclui tentativas distintas; não mede ganho de Jev.
- `apps/web/lib/api.ts`, ação `propose`: pede EDL inteira e transcrição inteira inclusive para gerar só três textos de gancho, descartando depois as demais alterações. É um alvo prioritário de redução de contexto e saída.
- O alinhamento original por palavra deve permanecer local e ser usado para reconstruir legendas e tempos. Enviar esse JSON inteiro para decisões semânticas é desnecessário.
- `structured()` já reutiliza respostas compatíveis com prompt, modelo e schema; falta uma política única de cache por conteúdo, versão de rubrica e etapa.

## Mapa de aplicações

Todas as linhas abaixo são propostas de arquitetura, ainda sem medição Jev no nosso domínio.

| Etapa / recurso                        | Aplicação proposta                                                                                          | Prioridade e limite                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Publicidade, saudação e inscrição      | Noul/Choice por trecho: publicidade, CTA, conteúdo editorial ou incerto                                     | P1. Filtrar antes de gastar planejamento; revisar casos incertos                      |
| Candidatos                             | Código cria janelas válidas com IDs; Jev avalia completude e relevância                                     | P1. O modelo escolhe entre limites existentes; não calcula timestamps                 |
| Pontuação                              | Seis perguntas Score separadas para hook, tensão, payoff, autonomia, densidade e emoção                     | P2. Começar como triagem; calibrar com as notas e critérios originais                 |
| Ranking / redundância                  | Notas e similaridade temática para ordenar e evitar assuntos repetidos                                      | P2. Sobreposição temporal e seleção final calculadas em código                        |
| Auditoria editorial                    | Perguntas independentes: promessa sustentada, hipótese preservada, conclusão completa e publicidade ausente | P1. Comparar inicialmente com auditoria atual e revisão humana                        |
| Cold open / reordenação                | Choice entre montagens candidatas; Noul sobre alteração de sentido                                          | P2. Candidatos válidos e fallback linear produzidos pelo código/LLM                   |
| Ganchos A/B                            | Qwen gera três textos curtos; Jev avalia fidelidade, clareza e pertinência                                  | P2. Não prediz vencedor real de retenção; teste de audiência é outra etapa            |
| Efeitos e assets                       | Choice entre IDs compatíveis já cadastrados, incluindo “nenhum”                                             | P3. Não inventar IDs, licenças ou instruções de render                                |
| Edição solicitada em linguagem natural | Classificar intenção para uma operação suportada                                                            | P3. Os quatro botões atuais já informam a intenção; ali uma chamada seria desperdício |
| Correção de legenda                    | Avaliar opções de nomes próprios com contexto e opção “incerto”                                             | P3. Não substituir reconhecimento de fala nem confirmar palavra sem evidência         |
| Retenção estimada / feedback           | Classificar riscos editoriais; extrair atributos para futura calibração                                     | P3. Não apresentar probabilidade Jev como retenção real ou promessa de viralização    |
| QA visual                              | Avaliar poucos frames representativos, opcionalmente                                                        | Experimental. Não substituir rastreamento local a 5 fps                               |
| Testes da interface                    | Agente exploratório separado, inspirado no repositório                                                      | Opcional. Verificações de API e regressões conhecidas continuam determinísticas       |

Não há benefício em chamar Jev para upload, downloads, permissões, fila, retry, SSE, durações, soma de notas, limites de palavras, velocidade, crop suavizado, codec, loudness, ffprobe, render ou cache. Essas operações já podem ser resolvidas localmente sem tokens. A transcrição e diarização continuam com WhisperX e os componentes locais.

## Pipeline proposto

1. WhisperX e análise local produzem palavras, cenas e sinais de áudio.
2. Código cria janelas por frases/pausas, com IDs e limites de duração do modo. Pausas e pontuação da ASR são indícios, não prova de conclusão narrativa.
3. Jev recebe texto e contexto relevante em pequenos lotes. Perguntas por candidato identificam publicidade, completude e qualidade. O código combina respostas e faz shortlist.
4. Qwen recebe somente os melhores candidatos e produz textos novos, justificativas específicas e decisões criativas. Em vez de regenerar EDL inteira, retorna um contrato pequeno com IDs de segmentos, overlays e alterações solicitadas.
5. Código compila a EDL canônica, preenche legendas com as palavras originais, calcula todos os tempos e valida o catálogo.
6. Jev avalia a montagem final em relação à fonte e aos ganchos. Casos incertos seguem para Qwen Max ou revisão. Rejeição deve produzir diagnóstico estruturado; somente a parte problemática volta para correção.
7. QA determinístico, exportação e revisão dos arquivos permanecem obrigatórios.

A skill de retenção permanece integral e versionada. No piloto, incluir seu texto original uma vez no estado compartilhado e ligar as perguntas às seções correspondentes. Evitar que uma nova rubrica altere silenciosamente a técnica exigida pelo prompt. Não repetir o texto inteiro em cada pergunta.

## Contratos e integração sugeridos

- Novo `packages/core/decision-provider.ts`: interface de decisões, validação Zod, timeout, AbortSignal, retry com limite e diagnóstico. SDK oficial no servidor; chave `TYPESAFE_API_KEY` no `.env`.
- Novo `packages/core/decision-rubrics.ts`: perguntas versionadas e rastreáveis à skill; exemplos positivos, negativos e ambíguos em português.
- `packages/core/llm.ts`: separar triagem, criação e auditoria; habilitar `DECISION_PROVIDER=llm|typesafe` e `DECISION_SHADOW=true` no piloto.
- `apps/web/lib/api.ts`: ganchos retornam apenas textos; propostas de edição retornam patches tipados e limitados ao pedido.
- `packages/edl`: compilação local das decisões com IDs existentes; manter validação atual e o contrato de EDL.
- Persistência SQLite: guardar modelo efetivo, versão das perguntas, skill hash, decisão, probabilidades, tokens, latência, fallback e resultado humano. Cache por hash da entrada completa, modelo fixado e contratos; invalidar após editar transcrição ou montagem.

Perguntas do mesmo estado podem ser enviadas juntas, conforme o padrão oficial de [fan-out](https://docs.typesafe.ai/patterns/fan-out). Perguntas adicionais têm custo de entrada; não são gratuitas. Evitar lotes enormes com todos os trechos de um vídeo. Não misturar avaliação independente com decisões que dependem de uma montagem ainda não produzida.

## Cuidados específicos

[Score](https://docs.typesafe.ai/primitives/score) aceita até dez níveis e devolve uma expectativa sobre níveis. Não equivale automaticamente às escalas atuais de 0–25 ou 0–20. No piloto usaremos ranking auxiliar; a migração das notas finais exige calibração e documentação. Justificativas livres e citações explicativas continuarão sendo geradas apenas para os cortes selecionados, quando necessárias.

[Confiança](https://docs.typesafe.ai/confidence) expressa a distribuição do modelo, não certifica verdade. Noul não retorna campo de confiança separado. Os limiares serão calibrados por pergunta; ausência de resposta nunca significará aprovação. A verificação compara o gancho à fonte, sem prometer checar fatos externos.

A documentação de [limitações](https://docs.typesafe.ai/model-jaggedness/jev-1.13) alerta para precisão numérica, indireção e contexto irrelevante. Precisamos testar nossos termos em português, gírias, nomes próprios e hipóteses. A [página de modelos](https://docs.typesafe.ai/models) indica melhor desempenho em inglês e recomenda avaliação nas demais línguas. Fixar a versão testada evita mudar resultados quando um alias for atualizado.

[Imagens e Box](https://docs.typesafe.ai/images) são experimentais. QA visual fica em experimento separado, com poucos frames e ativação explícita, pois o modo atual mantém os vídeos locais e essa opção enviaria imagens a um novo provedor. Não enviar a sequência inteira de frames. A autorização/chave Qwen não configura a conta TypeSafe.

## Economia e critérios do piloto

Preço consultado: US$ 0,042 por milhão de tokens de entrada; saída gratuita, conforme a [tabela oficial](https://docs.typesafe.ai/models). Exemplo ilustrativo: uma requisição com 12.000 tokens faturados custaria US$ 0,000504. Não inclui geração Qwen, repetições, impostos ou mudanças de preço. Confirmar condições da conta antes de ativar.

O gasto combinado deve ser medido como:

`custo = TypeSafe + geração Qwen remanescente + fallbacks + reparos`

Menos chamadas ao Qwen podem poupar sua quota do Token Plan, mas adicionam consumo TypeSafe. Não há percentual confiável de economia ou velocidade antes do teste. Jev não acelera a transcrição CPU nem o render e não substitui o modelo desta conversa de desenvolvimento.

Piloto proposto:

1. Usar o vídeo autorizado como um caso, acrescentando fontes variadas com publicidade, teoria/fato, conclusões incompletas e falas em português. Separar amostras de calibração e avaliação.
2. Executar Jev em modo sombra: registrar decisões, sem remover automaticamente candidatos. Comparar com revisão humana e com o pipeline atual.
3. Medir custo por corte editorialmente aprovado, tokens por provedor, reparos, fallback, latência p50/p95 e tempo total até exportação.
4. Medir anúncios que escaparam, conteúdo válido descartado, ganchos sem suporte, frases interrompidas e concordância entre revisores. Avaliar intervalos de incerteza; uma execução bem-sucedida não é homologação.
5. Meta inicial de engenharia, não previsão: reduzir pelo menos 30% do custo de IA por corte aprovado, com qualidade editorial preservada e latência p95 sem regressão. Se falhar, manter o caminho atual ou restringir Jev à tarefa que mostrou ganho.

Ordem recomendada: reduzir o contrato de geração e o contexto enviado; adicionar instrumentação; testar Jev na triagem e auditoria; só então expandir para pontuação, ganchos e catálogo. O produto continua executável sem TypeSafe quando a opção estiver desativada.
