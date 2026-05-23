# Character Zone System Redesign

**Date**: 2026-05-23
**Summary**: Consolidate four zone tables into one `character` table, add interaction tracking and zone change history, and implement three auto-engines: tap-based degradation, natural-acquisition promotion, and article-generation zone-awareness.

## Principles

- Curiosity module (curiosity/) — zero changes
- TTS module (tts/) — zero changes
- Students module (students/) — zero changes
- Existing zone data preserved via migration

## Data Model

### New: `character` table (replaces target_character, scout_character, ally_character, lost_character)

| Column | Type | Description |
|--------|------|-------------|
| id | int PK | auto-increment |
| student_id | int FK | student.id |
| character | varchar(1) | the Chinese character |
| zone | enum(target,scout,ally,lost) | current zone |
| tap_count | int default 0 | cumulative tap-to-speak count |
| appeared_in_articles | int default 0 | articles where this char appeared |
| never_tapped_in_articles | int default 0 | read articles where char was NOT tapped |
| first_seen_at | date | first time seen in any article |
| last_tapped_at | datetime | last tap timestamp |
| zone_changed_at | datetime | last zone change timestamp |
| source | varchar(20) | manual / reading / auto |
| created_at / updated_at | datetime | timestamps |

### New: `character_interaction` table

| Column | Type | Description |
|--------|------|-------------|
| id | int PK | auto-increment |
| student_id | int FK | |
| character | varchar(1) | |
| article_id | int FK nullable | article where tap occurred |
| created_at | datetime | |

### New: `character_zone_log` table

| Column | Type | Description |
|--------|------|-------------|
| id | int PK | auto-increment |
| student_id | int FK | |
| character | varchar(1) | |
| from_zone | varchar(10) | |
| to_zone | varchar(10) | |
| reason | varchar(20) | manual / auto_tap / auto_mastery |
| article_id | int FK nullable | |
| created_at | datetime | |

## Auto-Engines

### Engine 1: Tap Degradation

```
Trigger: child taps character in article (PinyinWord onClick)
  → INSERT character_interaction (student_id, character, article_id)
  → UPDATE character SET tap_count = tap_count + 1, last_tapped_at = now()
  → IF tap_count >= 3 AND zone = 'ally':
      → UPDATE character SET zone = 'target', zone_changed_at = now()
      → INSERT character_zone_log (from_zone='ally', to_zone='target', reason='auto_tap')
  → IF tap_count >= 3 AND zone = 'target':
      → No zone change; character stays in target for continued reinforcement
```

### Engine 2: Natural-Acquisition Promotion

```
Trigger: article marked "read" (POST /articles/{id}/read-status status=read)
  → Extract all Chinese characters from article content
  → FOR each character:
      → IF not in character table:
          → INSERT character (zone='scout', source='reading', first_seen_at=today)
      → IF zone = 'scout' AND character was NOT tapped in this article:
          → UPDATE character SET never_tapped_in_articles = never_tapped_in_articles + 1
          → IF never_tapped_in_articles >= 3:
              → UPDATE character SET zone = 'ally', zone_changed_at = now()
              → INSERT character_zone_log (from_zone='scout', to_zone='ally', reason='auto_mastery')
      → IF zone = 'ally' AND character WAS tapped in this article:
          → UPDATE character SET zone = 'target', zone_changed_at = now()
          → INSERT character_zone_log (from_zone='ally', to_zone='target', reason='auto_tap')
      → FOR all characters in article:
          → UPDATE character SET appeared_in_articles = appeared_in_articles + 1
```

### Engine 3: Article Generation Zone-Awareness

```
Trigger: POST /api/articles/generate
  → Query character table for current student:
      → ally chars (mastered, up to 30) → "放心使用"
      → target chars (learning, up to 10) → "请多次重复"
      → lost chars (struggling, tap_count desc, up to 10) → "重点复习"
  → Inject zone context into LLM prompt (build_zone_context)
  → Calculate article density based on zone distribution (calculate_article_params)
  → LLM generates article that respects character difficulty zones
```

### API Endpoints (new/modified)

- `POST /api/characters/interaction` — record a tap event (called by PinyinWord)
- `GET /api/characters/zone/{zone}` — unchanged signature, queries new `character` table
- `POST /api/characters/add` — unchanged signature
- `POST /api/characters/move` — unchanged signature, adds zone_log entry
- `GET /api/characters/stats` — unchanged signature

## Migration

One-time script: read all rows from 4 old tables, INSERT into new `character` table with `zone` set accordingly. Old tables dropped after verification.

## Files Changed

### Backend
- `app/models/character.py` — new single-table model + interaction + zone_log
- `app/domains/characters/repository.py` — rewrite to single table with zone filtering
- `app/domains/characters/service.py` — add interaction recording, auto-engine triggers
- `app/domains/characters/router.py` — add interaction endpoint
- `app/domains/articles/service.py` — add on_read_promotion trigger
- `app/domains/articles/repository.py` — inject zone context into generation prompt
- Migration script: `sql/migration_v2_characters.sql`

### Frontend
- `frontend/src/components/reader/PinyinWord.tsx` — report tap to new endpoint
- `frontend/src/pages/CharacterZonesPage.tsx` — minor UI updates for tap_count display
- `frontend/src/components/character/CharacterCard.tsx` — show tap_count badge
- `frontend/src/types/index.ts` — add CharacterItem fields
- `frontend/src/services/api.ts` — add reportInteraction method

## Not Changed

- `backend/app/domains/curiosity/` — zero changes
- `backend/app/domains/tts/` — zero changes
- `backend/app/domains/students/` — zero changes
- `backend/app/ai/` — zero changes
