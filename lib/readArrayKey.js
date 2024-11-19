const bs58Mod = require('bs58')
const fs = require('fs')

// Get the destination file path from CLI arguments
const destinationPath = process.argv[2]
const bs58 = bs58Mod.default

if (!destinationPath) {
  console.error('Error: Please provide the path to the id.json file as an argument.')
  console.error('Usage: node script.js <path_to_id.json>')
  process.exit(1)
}

try {
  // Read the JSON file
  const keypairArray = JSON.parse(fs.readFileSync(destinationPath, 'utf8'))
  const privateKey = bs58.encode(Uint8Array.from(keypairArray))

  console.log('Base58 Encoded Private Key:', privateKey)
} catch (error) {
  console.error('Error reading or parsing the file:', error.message)
  process.exit(1)
}