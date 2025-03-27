import whisper_s2t
import time
import json
import sys

model = whisper_s2t.load_model(model_identifier="tiny", backend='Ctranslate2', device='cpu', compute_type='int8')

if len(sys.argv) < 2:
    print("No audio file provided.")
    sys.exit(1)

print(f"Received file: {sys.argv[1]}")

files = [sys.argv[1]]
lang_codes = ['en']
tasks = ['transcribe']
initial_prompts = [None]

start_time = time.time()

output = model.transcribe_with_vad(files,
                                lang_codes=lang_codes,
                                tasks=tasks,
                                initial_prompts=initial_prompts,
                                batch_size=4)

end_time = time.time()

transcription_time = end_time - start_time

print(transcription_time)

# Convert np.float64 to Python float
for entry in output[0]:
    entry["start_time"] = float(entry["start_time"])
    entry["end_time"] = float(entry["end_time"])

# Print JSON so Node.js can parse it
whisper_s2t.write_outputs(output, format='json', ip_files=files, save_dir="/tmp") # Save outputs

