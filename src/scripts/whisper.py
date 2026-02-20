import time
import sys
import collections
import subprocess
import os
import torch
import torchaudio
import json
import argparse
from faster_whisper import WhisperModel, BatchedInferencePipeline

# ---- CONFIGURATION ----
SPEAKER_MODEL = "pyannote/speaker-diarization-3.1"

# ---- HELPER: Ensure input is 16kHz mono WAV ----
def ensure_wav(input_file):
    if input_file.lower().endswith('.wav'):
        return input_file
    wav_file = os.path.splitext(input_file)[0] + '.wav'
    if not os.path.exists(wav_file):
        print(f"Converting {input_file} to WAV...")
        subprocess.run([
            "ffmpeg", "-y", "-i", input_file,
            "-ar", "16000", "-ac", "1", wav_file
        ], check=True)
    return wav_file

# ---- PARSE ARGUMENTS ----
parser = argparse.ArgumentParser(description="Transcribe audio with Whisper and speaker diarization")
parser.add_argument("audio_file", help="Path to audio file")
parser.add_argument("huggingface_token", help="HuggingFace token for pyannote")
parser.add_argument("--doa-json", help="Path to DOA JSON file (skips pyannote)", default=None)
args = parser.parse_args()

HUGGINGFACE_TOKEN = args.huggingface_token
doa_json_path = args.doa_json
if doa_json_path is not None and not os.path.exists(doa_json_path):
    print(f"⚠️ Warning: DOA JSON file not found: {doa_json_path}. Falling back to pyannote.")
    use_doa_json = False
else:
    use_doa_json = doa_json_path is not None and os.path.exists(doa_json_path)

# ---- LOAD MODELS ----
try:
    print("Loading Faster-Whisper model ...")
    model = WhisperModel("large-v3", device="cuda", compute_type="int8")
    batched_model = BatchedInferencePipeline(model=model)

    if not use_doa_json:
        print("Loading pyannote diarization model ...")
        from pyannote.audio import Pipeline
        diarization_pipeline = Pipeline.from_pretrained(
            SPEAKER_MODEL,
            use_auth_token=HUGGINGFACE_TOKEN
        )
        diarization_pipeline.to(torch.device("cuda"))
    else:
        print("Using DOA JSON for speaker diarization (skipping pyannote)")
        diarization_pipeline = None
except Exception as e:
    print(f"Model loading failed: {e}")
    sys.exit(2)

print("CUDA available:", torch.cuda.is_available())

# ---- INPUT HANDLING ----
audio_file = ensure_wav(args.audio_file)
print(f"Received file: {audio_file}")

# ---- SPEAKER LABEL MAPPING ----
speaker_id_map = collections.OrderedDict()
def get_speaker_display(label):
    if label not in speaker_id_map:
        speaker_id_map[label] = f"Speaker {len(speaker_id_map) + 1}"
    return speaker_id_map[label]

def get_speaker_segments_from_doa_json(doa_json_path):
    """Load speaker segments from DOA JSON file (pyannote-compatible format)"""
    try:
        with open(doa_json_path, "r", encoding="utf-8") as f:
            doa_data = json.load(f)
        
        segments = []
        if "segments" in doa_data:
            for seg in doa_data["segments"]:
                segments.append({
                    "start": float(seg["start"]),
                    "end": float(seg["end"]),
                    "speaker": seg["speaker"]
                })
        else:
            print(f"⚠️ Warning: DOA JSON does not contain 'segments' key")
        
        print(f"✅ Loaded {len(segments)} speaker segments from DOA JSON")
        return segments
    except Exception as e:
        print(f"❌ Failed to load DOA JSON: {e}")
        raise

def get_speaker_segments(audio_file):
    """Get speaker segments using pyannote diarization"""
    if diarization_pipeline is None:
        raise ValueError("Diarization pipeline not initialized")
    
    waveform, sample_rate = torchaudio.load(audio_file)
    diarization = diarization_pipeline({
        "waveform": waveform,
        "sample_rate": sample_rate
    })
    segments = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segments.append({
            "start": float(turn.start),
            "end": float(turn.end),
            "speaker": get_speaker_display(speaker)
        })
    return segments

def find_speaker_label(start, end, speaker_segments):
    margin = 0.25 if use_doa_json else 0.1
    midpoint = (start + end) / 2
    for seg in speaker_segments:
        if seg["start"] - margin <= midpoint <= seg["end"] + margin:
            return seg["speaker"]
    return "Unknown"

# ---- TRANSCRIBE WITH FASTER-WHISPER ----
start_time = time.time()
segments, info = batched_model.transcribe(
    audio_file, 
    word_timestamps=True,
    vad_filter=True,
    vad_parameters=dict(min_silence_duration_ms=250),
    language="en",
    initial_prompt=None,
    beam_size=5,
    batch_size=16,
    condition_on_previous_text=True,
    temperature=0.0
    )

end_time = time.time()
print(f"Transcription time (s): {end_time - start_time:.2f}")

# ---- SPEAKER DIARIZATION ----
print("Running speaker diarization ...")
if use_doa_json:
    speaker_segments = get_speaker_segments_from_doa_json(doa_json_path)
else:
    speaker_segments = get_speaker_segments(audio_file)

# ---- FORMAT OUTPUT ----
final_output = []
for segment in segments:
    segment_dict = {
        "text": segment.text,
        "start_time": float(segment.start),
        "end_time": float(segment.end),
        "words": []
    }
    for word in segment.words:
        segment_dict["words"].append({
            "word": word.word,
            "start_time": float(word.start),
            "end_time": float(word.end),
            "speaker": find_speaker_label(word.start, word.end, speaker_segments)
        })
    final_output.append(segment_dict)

# ---- SAVE OUTPUT ----
out_path = f"/tmp/{os.path.splitext(os.path.basename(audio_file))[0]}_faster_whisper.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(final_output, f, indent=2, ensure_ascii=False)

print(f"✅ Output written to {out_path}")

# ---- CLEANUP WAV IF CONVERTED ----
def cleanup_wav_file(original_file, wav_file):
    if not original_file.lower().endswith('.wav') and os.path.exists(wav_file):
        try:
            os.remove(wav_file)
            print(f"🧹 Removed temporary WAV file: {wav_file}")
        except Exception as e:
            print(f"⚠️ Failed to delete WAV file: {e}")

cleanup_wav_file(args.audio_file, audio_file)
