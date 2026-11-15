# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [1.1.0] - 2026-11-15

### Added
- Interview picker: a chart of every cut (length, share of speech), draggable image/interview boundary, per-interview transcribe checkbox and language, thumbnail on hover, click to listen, All/None.
- Interview detection also uses speech (Silero VAD): long cuts without speech are not taken for interviews.
- Warnings when the detection is unclear, and an estimate of the transcription time.
- **Interviews…** button (Alt+I) to reopen the picker at any time.
- Filmstrip mark on interviews that were not transcribed.

## [1.0.0] - 2026-10-31

First public release.

### Added
- Shots from xmeml v4 (V1), thumbnails, player with stop at end of shot.
- Shot size, movement, description; progress and next pending.
- Interviews: automatic detection, soundbite fields, copy from previous.
- Local transcription (whisper.cpp large-v3 + Silero VAD) with language detection.
- Retranscription after a manual language change, queued in the background.
- Translation Spanish ⇄ English; Translate all.
- Live preview, autosaved drafts, agency `.txt` output.

[1.1.0]: https://github.com/jaimealekos/dopesheetwriter/releases/tag/v1.1.0
[1.0.0]: https://github.com/jaimealekos/dopesheetwriter/releases/tag/v1.0.0
