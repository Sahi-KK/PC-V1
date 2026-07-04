import openpyxl
import re

wb = openpyxl.load_workbook('../PGP-16 - Term-IV Schedule.xlsx', data_only=True)
ws_cal = wb['Schedule']

for i, row in enumerate(ws_cal.iter_rows(min_row=4, values_only=True)):
    slots = list(row[2:12])
    for slot in slots:
        if slot and str(slot).strip() not in ('SUNDAY', 'HOLIDAY', ''):
            raw = str(slot).strip()
            print(raw)
