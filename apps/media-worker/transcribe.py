import os
import sys
import json
from pathlib import Path
import whisperx
import torch

audio_path, output_path, language = sys.argv[1:4]
device = "cuda" if torch.cuda.is_available() else "cpu"
audio = whisperx.load_audio(audio_path)
model = whisperx.load_model(os.getenv("WHISPER_MODEL", "large-v3"), device, vad_method="silero", compute_type="float16" if device == "cuda" else "int8", language=None if language == "auto" else language.split("-")[0])
raw = model.transcribe(audio, batch_size=4)
del model
if not raw["segments"]:
    raise RuntimeError("Nenhuma fala detectada. Escolha um vídeo com voz audível.")
align_model, metadata = whisperx.load_align_model(language_code=raw["language"], device=device)
aligned = whisperx.align(raw["segments"], align_model, metadata, audio, device)
diarized = os.getenv("DIARIZATION", "false") == "true"
if diarized:
    from whisperx.diarize import DiarizationPipeline
    diarizer = DiarizationPipeline(use_auth_token=os.getenv("HF_TOKEN"), device=device)
    aligned = whisperx.assign_word_speakers(diarizer(audio), aligned)
words = [{"id": str(i), "t0": w["start"], "t1": w["end"], "text": w["word"].strip(), "emphasis": False, **({"speaker": w["speaker"]} if "speaker" in w else {})} for i,w in enumerate(aligned["word_segments"]) if "start" in w and "end" in w]
result = {"words": words, "language": raw["language"], "diarized": diarized, "raw": raw, "aligned": aligned}
Path(output_path).write_text(json.dumps(result, ensure_ascii=False))
