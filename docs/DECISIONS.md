# Decisões

1. A instrução posterior do usuário elimina Docker e Redis. BullMQ foi removido. A fila usa jobs em SQLite e claim transacional; um worker Node executa as tarefas sequencialmente. Não há compose nem infraestrutura externa.
2. Python 3.12 foi usado porque a máquina tinha 3.9 no sistema e 3.12 via Homebrew. 3.11 pode ser selecionado no Makefile. Não alteramos o Python do sistema.
3. MediaPipe 0.10.21 exige NumPy <2; WhisperX 3.3.4 exige NumPy >=2.0.2. Dois ambientes locais resolvem o conflito. O worker invoca o transcritor com argumentos, sem shell.
4. A skill anexa estava em `skill-retention-shorts/SKILL.md`; foi copiada integralmente para o caminho solicitado. Não foi reescrita.
5. Viral significa 12–25 s para validação, com alvo de 12–20 no system prompt. O máximo excepcional de 25 s vem da própria skill.
6. Os nomes de beats em JSON são `conflict|solution|suspense`, como no esquema da skill. A UI traduz os títulos dos critérios; beats mantêm o identificador técnico em alguns controles do protótipo.
7. Ingestão por link aceita apenas URLs HTTPS canônicas do YouTube com ID válido, sem credenciais ou portas alternativas, e requer declaração de direitos. yt-dlp baixa mídia pública sem cookies. URLs arbitrárias são rejeitadas; upload local permanece disponível.
8. Sem chave/modelo disponível, o sistema mostra falha acionável. Nenhuma nota heurística é apresentada como análise de IA real. A fixture sintética é exclusivamente de teste.
9. Remotion usa licença própria, não uma licença permissiva padrão. ffmpeg instalado com libx264 é GPL. Isso conflita com a restrição de dependências exclusivamente permissivas do prompt. Mantivemos as ferramentas explicitamente exigidas e registramos a exceção, sem alegar compatibilidade comercial universal.
10. Rec.709 é configurado no renderer com PNG e sinalização limitada. O teste inicial mostrou JPEG full-range; a regressão foi corrigida e `ffprobe` passou a exigir `yuv420p` e `bt709`.
11. Efeitos que não tinham implementação real (speed ramp e freeze) foram removidos do catálogo público. Os itens pendentes estão listados no STATUS. Não há botões que anunciam esses efeitos sem aplicá-los.
12. Versões, histórico de undo/redo e autosave são locais em SQLite. Export usa a EDL salva; alterações manuais de conteúdo exigem revisão de integridade.
13. O arquivo RTK.md não estava no repositório. Foi lida a cópia existente em `/Users/eduardo/.claude/RTK.md`; rtk 0.45.0 estava instalado.
