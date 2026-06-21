import pandas as pd
import json

df = pd.read_excel("/Applications/Antigravitty/PC-V1/PGP17 SPOC.xlsx")
# Forward-fill merged columns
df[['SPOC', 'SPOC Contact Details', ' SPOC Email ID']] = df[['SPOC', 'SPOC Contact Details', ' SPOC Email ID']].ffill()

# Columns: ['Sr No.', 'Roll No.', 'Name', 'SPOC', 'SPOC Contact Details', ' SPOC Email ID']

spocs = []
for index, row in df.iterrows():
    roll_no = str(row['Roll No.']).strip()
    if pd.isna(row['Roll No.']): continue
    
    spocs.append({
        "roll_no": roll_no,
        "name": str(row['Name']).strip() if not pd.isna(row['Name']) else "",
        "spoc_name": str(row['SPOC']).strip() if not pd.isna(row['SPOC']) else "",
        "spoc_contact": str(row['SPOC Contact Details']).strip() if not pd.isna(row['SPOC Contact Details']) else "",
        "spoc_email": str(row[' SPOC Email ID']).strip() if not pd.isna(row[' SPOC Email ID']) else ""
    })

with open("data/spocs.json", "w") as f:
    json.dump(spocs, f, indent=2)

print("Saved spocs.json!")
