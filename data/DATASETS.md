# Organizer datasets

Hackathon rules require using **datasets provided by the organizers** when supplied.

- Place CSV/JSON files from organizers under `data/organizer/` (create this folder when you receive files).
- Extend `backend/app/db/seed.py` (or add a small import script) to load those rows into SQLite alongside the current atomcamp-aligned seed catalog.
- Document the exact filename and schema in this file when you wire them in.

Current demo data: `data/courses.json` and `data/learners.json` are **atomcamp-aligned seeds** for local development and judging when no organizer file is present.
