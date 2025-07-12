import whisper_s2t
import time
import sys
import collections
import subprocess
import os
import torch
import torchaudio
from pyannote.audio import Pipeline

# ---- CONFIGURATION ----
HUGGINGFACE_TOKEN = sys.argv[2]
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

# ---- LOAD MODELS ----
try:
    print("Loading Whisper S2T model ...")
    model = whisper_s2t.load_model(
        model_identifier="large-v3",
        backend='CTranslate2',
        device='cuda',
        compute_type='int8',
        asr_options={'word_timestamps': True}
    )
    print("Loading pyannote diarization model ...")
    diarization_pipeline = Pipeline.from_pretrained(
        SPEAKER_MODEL,
        use_auth_token=HUGGINGFACE_TOKEN
    )
    diarization_pipeline.to(torch.device("cuda"))
except Exception as e:
    print(f"Model loading failed: {e}")
    sys.exit(2)

print("CUDA available:", torch.cuda.is_available())

# ---- INPUT HANDLING ----
if len(sys.argv) < 2:
    print("No audio file provided.")
    sys.exit(1)

audio_file = ensure_wav(sys.argv[1])
print(f"Received file: {audio_file}")

# ---- SPEAKER LABEL MAPPING ----
speaker_id_map = collections.OrderedDict()
def get_speaker_display(label):
    """Maps pyannote label (A, B, C) to Speaker 1, Speaker 2, ..."""
    if label not in speaker_id_map:
        speaker_id_map[label] = f"Speaker {len(speaker_id_map) + 1}"
    return speaker_id_map[label]

def get_speaker_segments(audio_file):
    """Runs diarization and returns list of {start, end, speaker}"""
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

def find_speaker_label(start, end, speaker_segments, margin=0.1):
    """Assigns speaker by checking overlap or proximity (with small margin)"""
    best_match = None
    best_score = 0

    for seg in speaker_segments:
        seg_start, seg_end = seg["start"], seg["end"]

        # Prefer full containment
        if start >= seg_start and end <= seg_end:
            return seg["speaker"]

        # Allow small margin for short/edge words
        overlap = max(0, min(end, seg_end + margin) - max(start, seg_start - margin))
        if overlap > best_score:
            best_score = overlap
            best_match = seg["speaker"]

    return best_match if best_match else "Unknown"


def assign_speaker_to_words(words, speaker_segments):
    """Assign speaker label to each word based on max overlap"""
    for word in words:
        word_start = float(word.get("start_time", 0))
        word_end = float(word.get("end_time", 0))
        word["speaker"] = find_speaker_label(word_start, word_end, speaker_segments)
    return words

# ---- TRANSCRIBE WITH WHISPER ----
files = [audio_file]
lang_codes = ['en']
tasks = ['transcribe']
initial_prompts = [None]

start_time = time.time()
output = model.transcribe_with_vad(
    files,
    lang_codes=lang_codes,
    tasks=tasks,
    initial_prompts=initial_prompts,
    batch_size=5,
    condition_on_previous_text=True,
    temperature=0.0
)
end_time = time.time()
print(f"Transcription time (s): {end_time - start_time:.2f}")

# ---- FORMAT TIMESTAMPS ----
for entry in output[0]:
    entry["start_time"] = float(entry["start_time"])
    entry["end_time"] = float(entry["end_time"])

# ---- SPEAKER DIARIZATION ----
print("Running speaker diarization ...")
speaker_segments = get_speaker_segments(audio_file)

# ---- ASSIGN SPEAKERS PER WORD ----
for entry in output[0]:
    # If word_timestamps are present, use them
    if "word_timestamps" in entry and isinstance(entry["word_timestamps"], list):
        # Convert to "words" and assign speaker to each word
        words = []
        for w in entry["word_timestamps"]:
            word_obj = {
                "word": w["word"],
                "start_time": float(w["start"]),
                "end_time": float(w["end"]),
                "speaker": find_speaker_label(float(w["start"]), float(w["end"]), speaker_segments)
            }
            words.append(word_obj)
        entry["words"] = words
        del entry["word_timestamps"]  # optional: clean up old format
    else:
        # Fallback for segment-level speaker assignment
        entry["speaker"] = find_speaker_label(entry["start_time"], entry["end_time"], speaker_segments)

# ---- OUTPUT JSON ----
try:
    whisper_s2t.write_outputs(
        output,
        format='json',
        ip_files=files,
        save_dir="/tmp"
    )
    print("Output written successfully.")
except Exception as e:
    print(f"Failed to write output: {e}")
    sys.exit(3)
