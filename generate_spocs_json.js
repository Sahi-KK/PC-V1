const fs = require('fs')
const xlsx = require('xlsx')

function parseSheet(file, batch) {
  const wb = xlsx.readFile(file)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const data = xlsx.utils.sheet_to_json(sheet)
  
  return data.map(row => ({
    name: row['Name'] || row['NAME'] || '',
    roll_no: row['Roll No.'] || row['Roll.No'] || row['Roll No'] || '',
    spoc_name: row['SPOC'] || '',
    spoc_contact: row['SPOC Contact Details'] || row['SPOC Contact'] || '',
    spoc_email: row[' SPOC Email ID'] || row['SPOC Email ID'] || row['SPOC Email'] || row['Email'] || '',
    batch: batch
  })).filter(row => row.name && row.roll_no)
}

const pgp16 = parseSheet('../PGP16 SPOC.xlsx', 'PGP16')
const pgp17 = parseSheet('../PGP17 SPOC.xlsx', 'PGP17')

const allSpocs = [...pgp16, ...pgp17]

fs.writeFileSync('./data/spocs.json', JSON.stringify(allSpocs, null, 2))
console.log(`Generated spocs.json with ${allSpocs.length} records.`)
