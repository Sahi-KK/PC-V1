const xlsx = require('xlsx')

function readExcel(file) {
  const wb = xlsx.readFile(file)
  const sheetName = wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  const data = xlsx.utils.sheet_to_json(sheet)
  return data.slice(0, 5) // Return top 5 for inspection
}

console.log('PGP16 SPOC:', readExcel('../PGP16 SPOC.xlsx'))
console.log('PGP17 SPOC:', readExcel('../PGP17 SPOC.xlsx'))
