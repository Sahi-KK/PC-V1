#!/usr/bin/env python3
import os
import re
import requests
from datetime import datetime
import openpyxl
from dotenv import load_dotenv

load_dotenv('.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SERVICE_KEY  = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SERVICE_KEY:
    raise ValueError("Missing SUPABASE_URL or SERVICE_KEY in .env.local")

HEADERS = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
}

THRESHOLD_DATE = '2000-01-01'
EXAM_START = '2026-08-23'
INDEPENDENCE_DAY = '2026-08-15'
MUHARRAM = '2026-06-26'

SECTION_LR = {'A': 'LR 02', 'B': 'LR 07', 'C': 'LR 06', 'D': 'LR 06'}
TIME_SLOTS = [
    '08:45-10:00', '10:20-11:35', '11:55-1:10', 'LUNCH',
    '14:30-15:45', '16:05-17:20', '17:40-18:55',
    '19:15-20:30', '20:50-22:05', '22:25-23:40'
]

def parse_class_code(code: str):
    code = str(code).strip()
    m = re.match(r'^([A-Za-z&]+)\s*(\d+)\s*\(', code)
    if m:
        abbr = m.group(1).strip()
        session = int(m.group(2))
        return abbr, session
    return code, 1

def main():
    print("Loading Excel file...")
    wb = openpyxl.load_workbook('../PGP-16 - Term-IV Schedule.xlsx', data_only=True)
    ws_cal = wb['Schedule']

    new_entries = []
    current_date = None

    for i, row in enumerate(ws_cal.iter_rows(min_row=4, values_only=True)):
        col0 = row[0]
        col1 = row[1]
        slots = list(row[2:12])

        if col0 is not None and isinstance(col0, datetime):
            current_date = col0.date().isoformat()

        if not current_date:
            continue

        if current_date < THRESHOLD_DATE:
            continue

        is_holiday = current_date in (INDEPENDENCE_DAY, MUHARRAM)
        is_exam = current_date >= EXAM_START

        if col1 and isinstance(col1, str) and col1 in ['A', 'B', 'C', 'D']:
            section = col1
            lr = SECTION_LR.get(section, '')
            for j, slot_time in enumerate(TIME_SLOTS):
                if slot_time == 'LUNCH':
                    continue
                if j < len(slots) and slots[j]:
                    raw = str(slots[j]).strip()
                    if raw.upper() in ('SUNDAY', 'HOLIDAY', ''):
                        continue
                    course_abbr, session_num = parse_class_code(raw)

                    new_entries.append({
                        'date': current_date,
                        'section': section,
                        'lr': lr,
                        'time_slot': slot_time,
                        'class_code': raw,
                        'course_abbr': course_abbr,
                        'session_number': session_num,
                        'is_holiday': is_holiday,
                        'is_exam_period': is_exam,
                    })

    print(f"Parsed {len(new_entries)} entries from Excel starting {THRESHOLD_DATE}.")

    # Fetch existing entries
    print(f"Fetching existing entries >= {THRESHOLD_DATE}...")
    url = f"{SUPABASE_URL}/rest/v1/calendar_entries"
    params = {
        'date': f"gte.{THRESHOLD_DATE}",
        'select': '*'
    }
    
    # We might need to paginate if there are many entries, but the Supabase default is 1000. Let's make sure we get all.
    headers = {**HEADERS, 'Range': '0-5000'}
    
    resp = requests.get(url, headers=headers, params=params)
    if resp.status_code != 200:
        raise Exception(f"Failed to fetch entries: {resp.text}")
    
    existing_entries = resp.json()
    print(f"Found {len(existing_entries)} existing entries.")

    # Create maps for matching
    # Key: (date, time_slot, section)
    existing_map = {(e['date'], e['time_slot'], e['section']): e for e in existing_entries}
    
    inserts = []
    updates = []
    processed_keys = set()

    for ne in new_entries:
        key = (ne['date'], ne['time_slot'], ne['section'])
        processed_keys.add(key)
        
        if key in existing_map:
            old_e = existing_map[key]
            # Check if it actually needs an update
            needs_update = False
            update_payload = {}
            for k in ['class_code', 'course_abbr', 'session_number', 'lr', 'is_holiday', 'is_exam_period']:
                if old_e.get(k) != ne[k]:
                    needs_update = True
                    update_payload[k] = ne[k]
            
            if needs_update:
                update_payload['id'] = old_e['id']
                updates.append(update_payload)
        else:
            inserts.append(ne)
            
    # Anything in existing_map not processed needs to be deleted
    deletes = []
    for key, old_e in existing_map.items():
        if key not in processed_keys:
            deletes.append(old_e['id'])
            
    print(f"Operations determined: {len(inserts)} inserts, {len(updates)} updates, {len(deletes)} deletes.")

    # Execute Deletes
    if deletes:
        print("Executing deletes...")
        del_url = f"{SUPABASE_URL}/rest/v1/calendar_entries"
        # Supabase API limits URL length, chunk if necessary. We'll do chunks of 100
        for i in range(0, len(deletes), 100):
            chunk = deletes[i:i+100]
            del_resp = requests.delete(
                del_url, 
                headers=HEADERS, 
                params={'id': f"in.({','.join(chunk)})"}
            )
            if del_resp.status_code not in (200, 204):
                print(f"Failed to delete chunk: {del_resp.text}")

    # Execute Updates
    if updates:
        print("Executing updates...")
        for u in updates:
            u_id = u.pop('id')
            upd_resp = requests.patch(
                f"{SUPABASE_URL}/rest/v1/calendar_entries",
                headers=HEADERS,
                params={'id': f"eq.{u_id}"},
                json=u
            )
            if upd_resp.status_code not in (200, 204):
                print(f"Failed to update {u_id}: {upd_resp.text}")

    # Execute Inserts
    if inserts:
        print("Executing inserts...")
        # Chunk inserts
        for i in range(0, len(inserts), 500):
            chunk = inserts[i:i+500]
            ins_resp = requests.post(
                f"{SUPABASE_URL}/rest/v1/calendar_entries",
                headers=HEADERS,
                json=chunk
            )
            if ins_resp.status_code not in (200, 201):
                print(f"Failed to insert: {ins_resp.text}")

    print("Sync complete.")

if __name__ == '__main__':
    main()
