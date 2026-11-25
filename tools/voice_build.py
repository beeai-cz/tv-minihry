"""WAV nahrávky z TV (art/raw/voice/*.wav) -> app/src/main/assets/common/voice/*.ogg + voice.js (text -> soubor).

Ořízne ticho na začátku a konci, srovná hlasitost a uloží jako Opus 40 kb/s mono.
Spuštění: python tools/voice_build.py  (po exportu na TV, viz tools/voice_phrases.py)
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art/raw/voice"
OUT = ROOT / "app/src/main/assets/common/voice"
FILTER = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,"
          "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,"
          "loudnorm=I=-16:TP=-1.5:LRA=11")

manifest = {}
for line in (OUT / "phrases.txt").read_text(encoding="utf-8").splitlines():
    pid, lang, text = line.split("|", 2)
    wav = RAW / f"{pid}.wav"
    if not wav.exists():
        print("chybí", pid, text)
        continue
    ogg = OUT / f"{pid}.ogg"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav), "-af", FILTER,
                    "-ar", "48000", "-ac", "1", "-c:a", "libopus", "-b:a", "40k", str(ogg)], check=True)
    manifest[f"{lang}|{text}"] = f"voice/{pid}.ogg"

(OUT / "voice.js").write_text(
    "/* Vygenerováno tools/voice_build.py: hláška -> nahrávka. TV.say ji přehraje místo pomalého TTS. */\n"
    "window.VOICE = " + json.dumps(manifest, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
print(len(manifest), "nahrávek")
