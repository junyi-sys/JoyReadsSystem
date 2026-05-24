"""Migrate character data from junyi_word (old 4-table) to junyi_word_v2 (unified character table)."""
import pymysql
from datetime import datetime

OLD_CFG = dict(host='localhost', port=3306, user='root', password='123456', database='junyi_word', charset='utf8mb4')
NEW_CFG = dict(host='localhost', port=3306, user='root', password='123456', database='junyi_word_v2', charset='utf8mb4')

def migrate():
    old = pymysql.connect(**OLD_CFG)
    new = pymysql.connect(**NEW_CFG)

    with new.cursor(pymysql.cursors.DictCursor) as cur:
        cur.execute("SELECT id FROM student ORDER BY id LIMIT 1")
        first = cur.fetchone()
        SID = first['id'] if first else 1

    inserted = 0
    try:
        # target_characters -> zone='target'
        with old.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute("SELECT `character`, source, added_at FROM target_characters")
            for row in cur.fetchall():
                inserted += upsert(new, sid=SID, ch=row['character'], zone='target',
                                   source=row.get('source', 'manual'),
                                   created_at=row.get('added_at'))

        # scout_characters -> zone='scout'
        with old.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute("SELECT `character`, source, first_seen_date, "
                        "appeared_in_read_count, never_tapped_in_read_count, created_at "
                        "FROM scout_characters")
            for row in cur.fetchall():
                inserted += upsert(new, sid=SID, ch=row['character'], zone='scout',
                                   source=row.get('source', 'reading'),
                                   appeared_in_articles=row.get('appeared_in_read_count', 0),
                                   never_tapped_in_articles=row.get('never_tapped_in_read_count', 0),
                                   first_seen_at=row.get('first_seen_date'),
                                   created_at=row.get('created_at'))

        # ally_characters -> zone='ally'
        with old.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute("SELECT `character`, source, created_at FROM ally_characters")
            for row in cur.fetchall():
                inserted += upsert(new, sid=SID, ch=row['character'], zone='ally',
                                   source=row.get('source', 'auto_promoted'),
                                   created_at=row.get('created_at'))

        # lost_characters -> zone='lost'
        with old.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute("SELECT `character`, tap_count, first_lost_date, created_at "
                        "FROM lost_characters")
            for row in cur.fetchall():
                inserted += upsert(new, sid=SID, ch=row['character'], zone='lost',
                                   source='manual',
                                   tap_count=row.get('tap_count', 0),
                                   first_seen_at=row.get('first_lost_date'),
                                   created_at=row.get('created_at'))

        new.commit()
        print(f"Done: {inserted} rows inserted")
    finally:
        old.close()
        new.close()


def upsert(conn, *, sid, ch, zone, **extra) -> int:
    ch = ch.strip()[0] if ch.strip() else ''
    if not ch:
        return 0
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM `character` WHERE student_id=%s AND `character`=%s AND zone=%s",
                    (sid, ch, zone))
        if cur.fetchone():
            return 0
        cur.execute(
            """INSERT INTO `character` (student_id, `character`, zone, tap_count,
               appeared_in_articles, never_tapped_in_articles, first_seen_at, source, created_at, updated_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (sid, ch, zone,
             extra.get('tap_count', 0),
             extra.get('appeared_in_articles', 0),
             extra.get('never_tapped_in_articles', 0),
             extra.get('first_seen_at'),
             extra.get('source', 'manual'),
             extra.get('created_at', datetime.now()),
             datetime.now())
        )
        return 1


if __name__ == '__main__':
    migrate()
