# Licenças

Inventário dos componentes diretos. Consulte o LICENSE de cada pacote e o inventário gerado para versões instaladas. **Não certificamos que toda a stack é permissiva**: há conflitos explícitos no prompt entre a stack exigida e essa restrição.

| Componente                                               | Licença declarada / condição                                                                                           |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Next.js, React, React DOM                                | MIT                                                                                                                    |
| Undici | MIT |
| yt-dlp | Unlicense; serviços de origem têm seus próprios termos |
| API Qwen / Model Studio | Serviço externo sujeito aos termos da conta; chave não distribuída |
| TypeScript                                               | Apache-2.0                                                                                                             |
| Tailwind CSS, PostCSS, Autoprefixer                      | MIT                                                                                                                    |
| Radix UI, class-variance-authority, clsx, tailwind-merge | MIT                                                                                                                    |
| Zustand, Zod, Drizzle ORM, better-sqlite3                | MIT                                                                                                                    |
| Anthropic TypeScript SDK                                 | MIT; uso do serviço também sujeito aos termos da API                                                                   |
| Remotion / Player / Renderer / Bundler                   | Licença própria Remotion: https://www.remotion.dev/docs/license; verifique condições aplicáveis antes de uso comercial |
| Lucide                                                   | ISC                                                                                                                    |
| Vitest, tsx, Prettier                                    | MIT                                                                                                                    |
| FastAPI, Uvicorn, HTTPX                                  | MIT / BSD-3-Clause conforme pacote                                                                                     |
| NumPy, SciPy                                             | BSD-3-Clause                                                                                                           |
| MediaPipe                                                | Apache-2.0; verifique modelos distribuídos                                                                             |
| PySceneDetect                                            | BSD-3-Clause                                                                                                           |
| OpenCV                                                   | Apache-2.0 nas versões usadas                                                                                          |
| WhisperX                                                 | BSD-2-Clause; pesos e componentes associados têm seus próprios termos                                                  |
| faster-whisper, CTranslate2                              | MIT                                                                                                                    |
| PyTorch/torchaudio                                       | BSD-style; componentes transitivos possuem avisos próprios                                                             |
| pyannote.audio                                           | MIT; modelos de diarização podem exigir conta, aceite de termos e HF_TOKEN                                             |
| Whisper / large-v3                                       | MIT conforme distribuição original; validar o repositório específico dos pesos baixados                                |
| Alinhamento por idioma                                   | Modelo escolhido pelo WhisperX; licença deve ser verificada antes de redistribuir pesos                                |
| ffmpeg com libx264                                       | GPL na instalação local usada; não é dependência exclusivamente permissiva                                             |
| Chrome Headless Shell                                    | Chromium e avisos de terceiros; baixado pelo Remotion, não redistribuído no código                                     |

Não há assets musicais/fontes/stickers de terceiros incluídos. `assets/ATTRIBUTION.md` registra isso. O projeto não redistribui binários de ffmpeg, pesos de modelos ou fontes de sistema. Os ambientes virtuais e node_modules são ignorados.

Arquivos de inventário gerados: `docs/npm-licenses.json`, `docs/python-packages.json` e `docs/whisper-packages.json`. Metadados de licença ausentes ou personalizados exigem análise antes de distribuição.
