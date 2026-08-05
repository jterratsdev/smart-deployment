---
name: transcription-evidence
version: "1.0.0"
description: Transcribe audio/video files and record as workflow evidence
inputs:
  - name: file
    description: Path to audio/video file (mp4, mp3, wav, m4a, webm)
    required: true
  - name: taskId
    description: Task ID to attach the evidence to
    required: true
  - name: role
    description: Role recording the evidence
    required: false
    default: qa
---

# Transcription Evidence Skill

Transcribes an audio or video file and records the transcript summary as evidence.

## Supported Formats

- Audio: mp3, wav, m4a, ogg, flac
- Video: mp4, webm, mkv (audio track extracted)

## Usage

```bash
# With insanely-fast-whisper (fastest local option, GPU recommended)
insanely-fast-whisper --file-name <file> --transcript-path /tmp/transcript.json

# With faster-whisper (4x faster than original, CPU-friendly)
faster-whisper <file> --model medium --output_format txt

# With original Whisper
whisper <file> --model base --output_format txt --output_dir /tmp/transcripts

# With OpenAI API (requires OPENAI_API_KEY)
curl -s https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F file="@<file>" \
  -F model="whisper-1" \
  -F response_format="text"
```

## Fallback Behavior

If no transcription API is available:
1. Check for `insanely-fast-whisper` CLI (pipx install insanely-fast-whisper)
2. Check for `faster-whisper` CLI (pip install faster-whisper)
3. Check for `whisper` CLI (pip install openai-whisper)
4. Check for `OPENAI_API_KEY` environment variable
5. If none available, record evidence with "transcription-pending" marker

## Evidence Recording

After transcription, record the result:

```bash
sf setup-agents evidence add \
  --task <taskId> \
  --role <role> \
  --type report \
  --summary "Transcript of <filename>: <first 200 chars of transcript>"
```
