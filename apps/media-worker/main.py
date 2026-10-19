import os
import json
import hashlib
import asyncio
import subprocess
import sys
import shutil
import re
from urllib.parse import urlparse, parse_qs
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel, Field
from config import ROOT, setting

STORAGE = (ROOT / os.getenv("STORAGE_DIR", "storage")).resolve()
app = FastAPI(title="ClipForge Media Worker")
lock = asyncio.Lock()

async def authorize(x_worker_token: Optional[str] = Header(default=None)):
    if x_worker_token != os.getenv("MEDIA_WORKER_TOKEN", "local-development-only"):
        raise HTTPException(401, "Token de mídia inválido.")

def safe(key: str) -> Path:
    path = (STORAGE / key).resolve()
    if STORAGE not in path.parents:
        raise HTTPException(400, "Caminho inválido.")
    return path

def run(args: list[str]) -> str:
    result = subprocess.run(args, capture_output=True, text=True, timeout=7200)
    if result.returncode:
        raise RuntimeError(result.stderr[-2500:])
    return result.stdout

def atomic_ffmpeg(args, target: Path):
    temporary = target.with_name(target.stem + ".tmp" + target.suffix)
    try:
        run(args + [str(temporary)])
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)

def cached_json(path: Path):
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return None

def save_json(path: Path, data):
    temporary = path.with_name(path.name + ".tmp")
    try:
        temporary.write_text(json.dumps(data, ensure_ascii=False))
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)

def sampled_frames(capture, total: int, step: int):
    for index in range(total):
        if not capture.grab():
            break
        if index % step:
            continue
        ok, frame = capture.retrieve()
        if not ok:
            break
        yield index, frame

class MediaRequest(BaseModel):
    source: str
    project_id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,100}$")
    language: str = "auto"

@app.get("/health")
async def health():
    return {"ok": True, "transcription": os.getenv("TRANSCRIPTION_PROVIDER", "whisperx")}

@app.post("/ingest-url", dependencies=[Depends(authorize)])
def ingest_url(req: MediaRequest):
    url = urlparse(req.source)
    video_id = parse_qs(url.query).get("v", [""])[0]
    if url.scheme != "https" or url.hostname != "www.youtube.com" or url.path != "/watch" or url.username or url.password or url.port or not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
        raise HTTPException(400, "Apenas URLs canônicas de vídeos públicos do YouTube são aceitas.")
    key = "sources/" + req.project_id + ".mp4"
    target = safe(key)
    if target.exists():
        return {"source": key}
    folder = safe("ingest/" + req.project_id)
    folder.mkdir(parents=True, exist_ok=True)
    try:
        run([sys.executable, "-m", "yt_dlp", "--no-playlist", "--no-warnings", "--socket-timeout", "30", "--retries", "2", "--fragment-retries", "2", "--max-filesize", "4G", "-f", "bv*[height<=1080]+ba/b[height<=1080]", "--merge-output-format", "mp4", "--remux-video", "mp4", "-o", str(folder / "source.%(ext)s"), "https://www.youtube.com/watch?v=" + video_id])
        output = folder / "source.mp4"
        if not output.exists() or output.stat().st_size > 4 * 1024**3:
            raise RuntimeError("Download ausente ou acima do limite de 4 GB.")
        target.parent.mkdir(parents=True, exist_ok=True)
        output.replace(target)
        return {"source": key, "source_url": req.source}
    except Exception as error:
        raise HTTPException(422, "Não foi possível obter a fonte pública. Sem contornar restrições: envie um arquivo local autorizado. " + str(error)[-1200:])
    finally:
        shutil.rmtree(folder, ignore_errors=True)

@app.post("/probe", dependencies=[Depends(authorize)])
def probe(req: MediaRequest):
    try:
        raw = json.loads(run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(safe(req.source))]))
        video = next(s for s in raw["streams"] if s["codec_type"] == "video")
        if not any(s["codec_type"] == "audio" for s in raw["streams"]):
            raise ValueError("O vídeo não possui áudio para transcrição.")
        a, b = video.get("avg_frame_rate", "30/1").split("/")
        return {"duration": float(raw["format"]["duration"]), "width": video["width"], "height": video["height"], "fps": float(a)/max(1,float(b)), "codec": video["codec_name"], "has_audio": True}
    except Exception as error:
        raise HTTPException(422, "Não foi possível ler o vídeo. Verifique se está íntegro e contém áudio. " + str(error))

@app.post("/prepare", dependencies=[Depends(authorize)])
def prepare(req: MediaRequest):
    folder = safe("projects/" + req.project_id)
    folder.mkdir(parents=True, exist_ok=True)
    source = safe(req.source)
    proxy, audio = folder / "proxy.mp4", folder / "audio.wav"
    if not proxy.exists():
        atomic_ffmpeg(["ffmpeg", "-y", "-i", str(source), "-vf", "scale=-2:720", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", "-c:a", "aac", "-movflags", "+faststart"], proxy)
    if not audio.exists():
        atomic_ffmpeg(["ffmpeg", "-y", "-i", str(source), "-vn", "-ac", "1", "-ar", "16000"], audio)
    measured = subprocess.run(["ffmpeg", "-i", str(audio), "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    voices = {}
    for name, denoise in [("voice", False), ("voice-clean", True)]:
        target = folder / (name + ".wav")
        if not target.exists():
            prefix = "afftdn=nf=-25," if denoise else ""
            first = subprocess.run(["ffmpeg", "-i", str(source), "-vn", "-af", prefix + "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
            import re
            match = re.search(r'\{[^{}]*"input_i"[^{}]*\}', first.stderr, re.S)
            if not match:
                raise RuntimeError("Não foi possível medir a voz.")
            m = json.loads(match.group())
            norm = f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
            atomic_ffmpeg(["ffmpeg", "-y", "-i", str(source), "-vn", "-af", prefix + norm, "-ar", "48000"], target)
        voices[name] = str(target.relative_to(STORAGE))
    return {"proxy": str(proxy.relative_to(STORAGE)), "audio": str(audio.relative_to(STORAGE)), "voices": voices, "loudness_log": measured.stderr[-1200:]}

def transcribe_sync(req: MediaRequest):
    path = safe("projects/" + req.project_id + "/transcript.json")
    cached = cached_json(path)
    if cached is not None:
        return cached
    audio_path = safe("projects/" + req.project_id + "/audio.wav")
    provider = os.getenv("TRANSCRIPTION_PROVIDER", "whisperx")
    if provider == "external":
        import httpx
        url = os.getenv("EXTERNAL_TRANSCRIPTION_URL")
        if not url:
            raise RuntimeError("Configure EXTERNAL_TRANSCRIPTION_URL para usar a API externa.")
        with audio_path.open("rb") as audio:
            response = httpx.post(url, headers={"Authorization": "Bearer " + os.getenv("EXTERNAL_TRANSCRIPTION_KEY", "")}, files={"file": audio}, data={"timestamp_granularities[]": "word", "response_format": "verbose_json"}, timeout=3600)
        response.raise_for_status()
        raw = response.json()
        words = [{"id": str(i), "t0": w["start"], "t1": w["end"], "text": w["word"].strip(), "emphasis": False} for i,w in enumerate(raw["words"])]
        result = {"words": words, "language": raw.get("language", "pt"), "diarized": False, "raw": raw}
    else:
        interpreter = Path(os.getenv("WHISPER_PYTHON", str(ROOT / ".venv-whisper/bin/python")))
        if not interpreter.is_absolute():
            interpreter = ROOT / interpreter
        if not interpreter.exists():
            raise RuntimeError("Transcritor local não instalado. Execute make whisper ou configure TRANSCRIPTION_PROVIDER=external.")
        output = path.with_suffix(".aligned.tmp.json")
        try:
            run([str(interpreter), str(ROOT / "apps/media-worker/transcribe.py"), str(audio_path), str(output), req.language])
            result = json.loads(output.read_text())
        finally:
            output.unlink(missing_ok=True)
    save_json(path, result)
    return result

@app.post("/transcribe", dependencies=[Depends(authorize)])
async def transcribe(req: MediaRequest):
    async with lock:
        try:
            return await asyncio.to_thread(transcribe_sync, req)
        except Exception as error:
            raise HTTPException(422, str(error))

def smooth_crop(points, fps=5):
    result = []
    cx, cy = .5, .4
    alpha = setting("cropSmoothing")
    limit = setting("cropMaxVelocity") / fps
    for point in points:
        target_x, target_y = point["cx"], point["cy"]
        cx += max(-limit, min(limit, (target_x-cx)*alpha))
        cy += max(-limit, min(limit, (target_y-cy)*alpha))
        result.append({"t": point["t"], "cx": cx, "cy": cy, "scale": 1})
    return result

@app.post("/analyze", dependencies=[Depends(authorize)])
def analyze(req: MediaRequest):
    path = safe("projects/" + req.project_id + "/analysis.json")
    cached = cached_json(path)
    if cached is not None:
        return cached
    import numpy as np
    import cv2
    import mediapipe as mp
    from scenedetect import detect, ContentDetector
    proxy = safe("projects/" + req.project_id + "/proxy.mp4")
    source = proxy if proxy.exists() else safe(req.source)
    scenes = [{"start": a.get_seconds(), "end": b.get_seconds()} for a,b in detect(str(source), ContentDetector())]
    silence = subprocess.run(["ffmpeg", "-i", str(source), "-af", f"silencedetect=noise={setting('silenceDb')}dB:d={setting('silenceSeconds')}", "-f", "null", "-"], capture_output=True, text=True).stderr
    cap = cv2.VideoCapture(str(source))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    step = max(1, round(fps / setting("faceSampleFps")))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    import wave
    with wave.open(str(safe("projects/"+req.project_id+"/audio.wav"))) as wav:
        audio = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).astype(float) / 32768
        rate = wav.getframerate()
    transcript_path = safe("projects/"+req.project_id+"/transcript.json")
    transcript = json.loads(transcript_path.read_text()).get("words", []) if transcript_path.exists() else []
    points, faces, previous_mouths = [], [], {}
    speaker_votes = {}
    active_slot, last_switch = 0, -10
    detector = mp.solutions.face_detection.FaceDetection(min_detection_confidence=.5)
    for index, frame in sampled_frames(cap, total, step):
        detected = detector.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        boxes = []
        for face in detected.detections or []:
            box = face.location_data.relative_bounding_box
            boxes.append({"cx": box.xmin+box.width/2, "cy": box.ymin+box.height/2, "area": box.width*box.height})
        boxes.sort(key=lambda b: b["cx"])
        moment = index/fps
        window = audio[int(moment*rate):int((moment+.2)*rate)]
        rms = float(np.sqrt(np.mean(window**2))) if len(window) else 0
        motions = []
        frame_h, frame_w = frame.shape[:2]
        for slot, box in enumerate(boxes):
            side = max(12, int(np.sqrt(box["area"])*min(frame_w, frame_h)*.35))
            x, y = int(box["cx"]*frame_w), int((box["cy"]+.04)*frame_h)
            region = frame[max(0,y-side//2):min(frame_h,y+side//2),max(0,x-side):min(frame_w,x+side)]
            if region.size:
                mouth = cv2.resize(cv2.cvtColor(region, cv2.COLOR_BGR2GRAY), (48,24)).astype(float)
                prior = previous_mouths.get(slot)
                motion = float(np.mean(np.abs(mouth-prior))) if prior is not None else 0
                previous_mouths[slot] = mouth
            else:
                motion = 0
            motions.append(motion)
        speaker = next((w.get("speaker") for w in transcript if w["t0"] <= moment <= w["t1"]), None)
        if boxes:
            proposed = int(np.argmax(motions)) if rms > 10**(setting("silenceDb")/20) else active_slot
            if speaker and rms > 10**(setting("silenceDb")/20):
                votes = speaker_votes.setdefault(speaker, {})
                for slot, motion in enumerate(motions):
                    votes[slot] = votes.get(slot, 0)*.95+motion
                proposed = max(votes, key=votes.get)
            if proposed != active_slot and moment-last_switch >= .8:
                active_slot, last_switch = proposed, moment
            chosen = boxes[min(active_slot,len(boxes)-1)]
        else:
            chosen = {"cx": .5, "cy": .4}
        points.append({"t": index/fps, "cx": max(0,min(1,chosen["cx"])), "cy": max(0,min(1,chosen["cy"]))})
        faces.append({"t": index/fps, "faces": boxes})
    cap.release()
    detector.close()
    import wave
    with wave.open(str(safe("projects/"+req.project_id+"/audio.wav"))) as wav:
        audio = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).astype(float) / 32768
        rate = wav.getframerate()
    energy = [{"t": i/rate, "rms": float(np.sqrt(np.mean(audio[i:i+int(rate/5)]**2)))} for i in range(0,len(audio),int(rate/5))]
    result = {"scenes": scenes, "silences_log": silence[-20000:], "faces": faces, "crop": smooth_crop(points), "energy": energy, "active_speaker_method": "audio_energy_mouth_motion_diarization", "speaker_face_votes": speaker_votes, "warnings": ["Locutor ativo usa heurística de movimento facial e energia, com diarização quando disponível; revise alternâncias em vídeos com múltiplos participantes."]}
    save_json(path, result)
    return result
