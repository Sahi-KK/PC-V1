const fs = require('fs');
const PDFParser = require('pdf2json');

function extractText(filePath, outPath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(this, 1);
        
        pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", pdfData => {
            fs.writeFileSync(outPath, pdfParser.getRawTextContent());
            resolve(pdfParser.getRawTextContent());
        });
        
        pdfParser.loadPDF(filePath);
    });
}

async function run() {
    console.log("Extracting policy...");
    await extractText('../Important Docs/The Placement Policy 2026-2027.pdf', 'data/placement_policy.txt');
    console.log("Policy extracted!");
    
    console.log("Extracting report...");
    await extractText('../Important Docs/Final Placement Report 2024-26.pdf', 'data/placement_report.txt');
    console.log("Report extracted!");
}
run();
