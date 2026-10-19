import json
import sys
import subprocess
import tempfile
import wave
from pathlib import Path
import numpy as np
from scipy.signal import correlate, resample, fftconvolve

edl = json.loads(Path(sys.argv[1]).read_text())
voice, output = sys.argv[2:4]
def load_wav(path):
    with wave.open(str(path)) as wav:
        if wav.getnchannels()!=1 or wav.getsampwidth()!=2:
            raise ValueError('Expected mono PCM16')
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).astype(float) / 32768
with tempfile.TemporaryDirectory() as folder:
    paths = [Path(folder)/'original.wav', Path(folder)/'render.wav']
    for source,target in zip([voice,output],paths):
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',source,'-ac','1','-ar','16000','-c:a','pcm_s16le',str(target)],check=True)
    original, rendered = [load_wav(path) for path in paths]
    candidates=[word for word in edl['captions']['words'] if word['t1']-word['t0']>=.22]
    picks=[]
    for fraction in [.05,.2,.4,.6,.8,.95]:
        if candidates:
            word=candidates[min(len(candidates)-1,round((len(candidates)-1)*fraction))]
            if word not in picks:
                picks.append(word)
    checks=[]
    for word in picks:
        segment=next((s for s in edl['segments'] if s['out_start']-.001<=word['t0']<s['out_start']+(s['src_end']-s['src_start'])/s['speed']),None)
        if not segment:
            continue
        pad=.03
        source_start=segment['src_start']+(word['t0']-segment['out_start']+pad)*segment['speed']
        source_end=segment['src_start']+(word['t1']-segment['out_start']-pad)*segment['speed']
        expected=original[round(source_start*16000):round(source_end*16000)]
        expected=resample(expected,max(1,round((word['t1']-word['t0']-2*pad)*16000)))
        target_start=round((word['t0']+pad)*16000)
        lo=max(0,target_start-2400);hi=min(len(rendered),target_start+len(expected)+2400)
        actual=rendered[lo:hi]
        expected=expected-expected.mean();actual=actual-actual.mean()
        correlations=correlate(actual,expected,mode='valid',method='fft')
        energies=fftconvolve(actual**2,np.ones(len(expected)),mode='valid')
        normalized=correlations/np.sqrt(np.maximum(energies*np.sum(expected**2),1e-12))
        best=int(np.argmax(normalized));lag_ms=(lo+best-target_start)/16
        confidence=float(normalized[best]);passed=abs(lag_ms)<=80 and confidence>=.7
        checks.append({'word':word['text'],'output_t0':word['t0'],'lag_ms':lag_ms,'correlation':confidence,'passed':passed})
    result={'method':'waveform correlation against source voice; measures drift introduced by rendering, not ASR ground-truth accuracy','passed':len(checks)>=3 and all(c['passed'] for c in checks),'checks':checks}
    print(json.dumps(result,ensure_ascii=False))
