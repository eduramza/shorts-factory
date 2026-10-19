---
name: retention-shorts
description: Transforma um vídeo longo (transcrição + metadados) em cortes verticais (Shorts/TikTok/Reels) otimizados para a linha de retenção, usando a estrutura Hook → Storytelling → Payoff. Seleciona os trechos, pontua, reordena o gancho, define cortes, legendas, zooms, música e efeitos, e devolve uma Edit Decision List (EDL) em JSON.
---

# Skill: Retention Shorts (Hook → Storytelling → Payoff)

## 0. Origem e honestidade metodológica

Base: vídeo "ESSA TÉCNICA VIRALIZOU MEU SHORTS COM 30 MILHÕES DE VISUALIZAÇÕES" (canal O Milionário, ID iPpt_INjn8A). Itens marcados **[VÍDEO]** vêm do que o autor ensina. Itens marcados **[EXT]** são extensões de engenharia deste sistema: heurísticas razoáveis, mas **não comprovadas pelo vídeo**. Devem ser calibradas com dados reais de retenção (ver seção 10).

## 1. Princípio central [VÍDEO]

- O que decide se um vídeo curto viraliza é a **linha de retenção**: quanto mais pessoas assistem até o fim, mais a plataforma distribui.
- Objetivo: deixar a linha de retenção **o mais reta possível, sem quedas**. O que importa é o espectador chegar ao final.
- Três partes obrigatórias: **Hook (gancho)**, **Storytelling (narrativa)**, **Payoff (recompensa)**.
- O roteiro/narrativa é "o motor do carro": edição bonita sem narrativa não segura.
- Duração: vídeos até ~15 s tendem a explodir mais, porque é mais fácil assistir inteiro. Vídeos maiores são mais difíceis de viralizar, mas constroem público fiel. Se o nicho exige vídeos maiores, use as mesmas três etapas.

## 2. Modos de duração [VÍDEO + EXT]

| Modo | Duração alvo | Quando usar |
|---|---|---|
| `viral` | 12–20 s (máx. 25) | Maximizar alcance. Padrão. |
| `balanced` | 20–40 s | Conteúdo com contexto mínimo. |
| `authority` | 40–75 s | Construir público fiel, conteúdo mais profundo. |

O usuário escolhe o modo. Nunca ultrapasse o limite do modo, mesmo que o trecho seja bom: encurte cortando partes mortas.

## 3. Pipeline de decisão (siga na ordem)

### Passo 1: Segmentar candidatos
- Entrada: transcrição com timestamp por palavra, quebras de cena, silêncios, locutores.
- Gere janelas candidatas começando e terminando em **limites de frase** (nunca no meio de uma frase ou ideia). Gere 3× mais candidatos do que o número pedido.
- Cada candidato deve ser **autocontido**: um espectador sem contexto precisa entender sem o resto do vídeo. Se depender de contexto anterior, descarte ou prepare uma legenda de contexto (seção 6).

### Passo 2: Pontuar cada candidato (0–100)

| Critério | Peso | O que avaliar |
|---|---|---|
| Hook potencial | 25 | Existe uma frase ou momento que, nos primeiros 3 s, é **claro, direto, rápido e promete recompensa** [VÍDEO]? |
| Tensão/narrativa | 25 | Há conflito, algo que dá errado, obstáculo, pergunta aberta ou suspense [VÍDEO]? Há solução? |
| Payoff | 20 | O final entrega o que o gancho prometeu (resultado, revelação, emoção, conclusão) [VÍDEO]? |
| Autocontido | 15 | Faz sentido sozinho? [EXT] |
| Densidade/ritmo | 10 | Pouca enrolação, poucas pausas, informação a cada poucos segundos [EXT] |
| Emoção/novidade | 5 | Surpresa, humor, opinião forte, número impactante [EXT] |

Regras:
- Hook < 12/25 **ou** Payoff < 8/20 → descarte, qualquer que seja a nota total.
- Mostre ao usuário a nota por critério e uma justificativa de 1 linha para cada.
- Ordene por nota. Evite cortes sobrepostos (> 30% de sobreposição): fique com o melhor.

### Passo 3: Mapear a estrutura Hook → Storytelling → Payoff

Para o candidato escolhido, marque na linha do tempo:

- **HOOK (0–3 s)** [VÍDEO]: claro, direto, rápido, com promessa. Sem saudação, sem "olá pessoal", sem "então", sem apresentação.
- **STORYTELLING (meio)** [VÍDEO]: sequência de beats de tensão. Cada beat é um dos tipos: `conflito` (algo dá errado), `solução` (o que se faz), `suspense` ("mas antes de… algo aconteceu"). A narrativa deve ter um momento em que a história "é cortada" e cria curiosidade.
- **PAYOFF (últimos 3–5 s)** [VÍDEO]: entrega a recompensa prometida pelo gancho.

Se o trecho original **não** abre com um gancho forte, aplique a técnica **Cold Open** [EXT]:
1. Localize no próprio trecho a frase mais forte (a promessa, o resultado ou a frase mais provocativa).
2. Coloque essa frase **no início** (0–3 s) como gancho, depois volte à ordem cronológica.
3. Só faça isso se a frase fizer sentido sozinha e se o payoff continuar claro. Não distorça o sentido: **proibido alterar o significado do que a pessoa disse**.

### Passo 4: Engenharia do gancho [VÍDEO + EXT]
- Gere **3 variações** de texto de gancho na tela (título de abertura), com ≤ 8 palavras cada:
  - Promessa de resultado ("O presente de R$5 que fez minha avó chorar").
  - Curiosidade/lacuna ("Eu só tinha R$5 e…").
  - Contradição/provocação.
- O texto deve ser verdadeiro em relação ao conteúdo (sem clickbait que o payoff não sustenta).
- Deve ser lido em ≤ 2 s.

### Passo 5: Limpeza de ritmo [EXT]
- Remova silêncios > 0,35 s, hesitações ("é", "né", "tipo", "ããã"), repetições e falsos começos.
- Mantenha micro-pausas de 0,1–0,2 s antes de uma revelação (tensão), onde a pausa tem função.
- Não corte no meio de uma sílaba: use pontos de corte em zero-crossing de áudio e crossfade de 30–60 ms.
- Se o resultado ficar acima do limite do modo, remova primeiro os beats de menor tensão do meio, nunca o hook nem o payoff.

### Passo 6: Plano de edição [VÍDEO + EXT]

Elementos que o vídeo recomenda, para o espectador "não perceber o tempo passar" [VÍDEO]:
1. **Legendas dinâmicas**: palavra a palavra, com destaque na palavra falada.
2. **Zooms** e **cortes rápidos**: sempre algo acontecendo.
3. **Troca de música entre cenas**: dá sensação de várias coisas ao mesmo tempo.
4. **Trilha de suspense** no trecho de tensão, para gerar vontade de ver o final.

Parâmetros operacionais sugeridos [EXT], ajustáveis:
- **Cadência visual**: uma mudança visual (zoom, corte, troca de enquadramento, destaque, b-roll) a cada **1,5–3,5 s**. Nunca mais de 4 s sem mudança.
- **Zooms**: punch-in 105–115% em palavras de ênfase; zoom lento (100→108%) em trechos de tensão; reset no corte seguinte. Alterne a direção para não cansar.
- **Legendas**: 1–3 palavras por vez, ≤ 2 linhas, palavra ativa em cor de destaque, posição no terço inferior (fora da zona de interface do app: manter margem inferior de ~20% e lateral de ~6%). Emoji só quando reforça a palavra.
- **Música**:
  - Beat 1 (hook e começo): energia média, entra em 0 s.
  - Beat de tensão: trilha de suspense, volume sobe levemente, graves mais presentes.
  - Payoff: resolve (queda da tensão ou swell + silêncio de 0,2 s antes da revelação).
  - Troca de música: só em limites de beat/cena, com crossfade de 200–400 ms.
  - Voz sempre sobre a música: ducking de −14 a −18 dB sob a fala.
- **SFX**: whoosh em cortes/zoom, hit em revelações, risers antes do payoff. Máx. 1 SFX a cada ~2 s.
- **B-roll/imagem de apoio**: quando houver algo concreto citado (objeto, lugar, número), mostre por 1–2 s.
- **Barra de progresso** discreta (opcional): reforça a expectativa de chegar ao fim.

### Passo 7: Final do vídeo [EXT]
- O payoff deve ser o **último** momento relevante. Corte imediatamente após a frase final (≤ 0,3 s de folga).
- Opcional, **modo loop**: se o final puder emendar visual ou verbalmente com o gancho, mantenha o último frame próximo ao primeiro.
- Sem "obrigado por assistir" ou chamada para ação que quebre o fim. Se houver CTA, use texto discreto sobre o payoff.

## 4. Anti-padrões (rejeite ou corrija)

- Abrir com saudação, contexto longo ou "hoje eu vou falar sobre".
- Hook que promete algo que o payoff não entrega.
- Trecho que termina no meio de uma ideia.
- Mais de 4 s sem mudança visual.
- Música alta competindo com a voz.
- Legenda fora da área segura ou ilegível.
- Cortes que mudam o sentido da fala.
- Vídeo longo demais para o modo escolhido.
- Efeitos que não servem à retenção (decoração).

## 5. Formato de saída: Edit Decision List (EDL) em JSON

A saída deve ser **somente JSON válido**, conforme o esquema abaixo.

```json
{
  "clip_id": "string",
  "mode": "viral|balanced|authority",
  "source": { "start": 0.0, "end": 0.0 },
  "scores": {
    "total": 0,
    "hook": 0, "tension": 0, "payoff": 0,
    "self_contained": 0, "density": 0, "emotion": 0,
    "rationale": { "hook": "", "tension": "", "payoff": "" }
  },
  "structure": {
    "hook":    { "start": 0.0, "end": 3.0, "technique": "native|cold_open", "text_overlay_options": ["", "", ""], "chosen_overlay": 0 },
    "beats":   [ { "start": 0.0, "end": 0.0, "type": "conflict|solution|suspense", "note": "" } ],
    "payoff":  { "start": 0.0, "end": 0.0, "note": "" }
  },
  "segments": [
    { "id": "s1", "src_start": 0.0, "src_end": 0.0, "out_start": 0.0, "role": "hook|body|payoff", "speed": 1.0 }
  ],
  "cuts_removed": [ { "src_start": 0.0, "src_end": 0.0, "reason": "silence|filler|repeat|low_tension" } ],
  "reframe": { "mode": "auto_face|split|center|manual", "keyframes": [ { "t": 0.0, "cx": 0.5, "cy": 0.4, "scale": 1.0 } ] },
  "captions": { "style": "string", "words": [ { "t0": 0.0, "t1": 0.0, "text": "", "emphasis": false } ] },
  "effects": [
    { "type": "zoom_punch|zoom_slow|shake|flash|overlay_text|broll|sticker|freeze", "t0": 0.0, "t1": 0.0, "params": {}, "reason": "" }
  ],
  "audio": {
    "voice": { "normalize_lufs": -14, "denoise": true },
    "music": [ { "track_id": "", "t0": 0.0, "t1": 0.0, "mood": "energetic|suspense|resolve", "gain_db": -16, "ducking": true, "fade_in": 0.2, "fade_out": 0.3 } ],
    "sfx": [ { "id": "", "t": 0.0, "gain_db": -10 } ]
  },
  "retention_forecast": { "curve": [ { "t": 0.0, "pct": 100 } ], "risk_points": [ { "t": 0.0, "why": "" } ] },
  "qa": { "passed": true, "violations": [] },
  "duration_out": 0.0
}
```

Regras do JSON:
- Todos os tempos em segundos, relativos ao vídeo original (`src_*`) ou ao vídeo final (`out_*`, `t0`, `t1`, `t`).
- `segments` descrevem a montagem final em ordem de exibição (inclui o cold open, se usado).
- Todo `effect` precisa de `reason` ligado à retenção (ex.: "evita 4 s sem mudança em 12–16 s").
- `retention_forecast` é uma **estimativa heurística**, não uma medição. Rotule como tal na interface.

## 6. Contexto ausente
Se o trecho exigir contexto que ele mesmo não explica, adicione um `overlay_text` curto (≤ 8 palavras) nos primeiros 3 s, ou descarte o candidato.

## 7. Checklist de QA (execute antes de devolver)

1. Os primeiros 3 s têm gancho claro e promessa? 
2. Existe pelo menos 1 beat de tensão e uma resolução?
3. O payoff entrega a promessa do hook?
4. Duração dentro do modo?
5. Nenhum trecho > 4 s sem mudança visual?
6. Nenhum corte no meio de palavra/ideia?
7. Legendas em área segura, ≤ 3 palavras por vez?
8. Música com ducking sob a voz e troca só em limites de cena?
9. Significado do original preservado?
10. Final corta logo após o payoff?

Se algum item falhar, corrija e reavalie (até 2 iterações). Se continuar falhando, devolva `qa.passed=false` com as violações.

## 8. Regras de segurança e integridade
- Nunca invente falas ou fatos que não estejam na transcrição.
- Nunca altere o sentido de uma fala ao reordenar.
- Gancho em texto deve ser verdadeiro em relação ao conteúdo.
- Não gere cortes de conteúdo que o usuário não declarou possuir ou ter licença para usar.

## 9. Variações A/B [EXT]
Quando solicitado, gere até 3 variações do mesmo corte, alterando **uma** variável por vez (gancho em texto, ordem do cold open, ou estilo de legenda). Registre qual variável foi alterada.

## 10. Calibração com dados reais [EXT]
Os pesos e parâmetros desta skill são pontos de partida. O sistema deve:
- Registrar, para cada corte publicado, a curva de retenção real (quando o usuário importar do YouTube Studio/TikTok).
- Comparar curva real com `retention_forecast`, e a nota com o resultado.
- Sugerir ajustes de pesos quando houver ≥ 30 cortes com dados.
