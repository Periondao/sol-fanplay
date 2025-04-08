const bs58Mod = require('bs58')
const fs = require('fs')

// Get the destination file path from CLI arguments
const toBase64 = process.argv.includes('--toBase64')
const isBase64 = process.argv.includes('--isBase64')
const inlineKey = process.argv.includes('--inline')
const keyOrPath = process.argv[2]
const bs58 = bs58Mod.default

if (!keyOrPath) {
  console.error('Error: Please provide a key or path to the id.json file as an argument.')
  console.error('Usage: yarn printKey <path_to_id.json>')
  process.exit(1)
}

if (inlineKey && isBase64) {
  const privateKey = process.argv[2]
  const keyBuffer = Buffer.from(privateKey, 'base64')
  const encodedKey = bs58.encode(keyBuffer)
  console.log('Base58 Encoded Private Key:', encodedKey)
  return
}

if (inlineKey) {
  // Read key passed in as array
  const keyArray = JSON.parse(keyOrPath)
  const keyBuffer = Buffer.from(keyArray)
  const encodedKey = bs58.encode(keyBuffer)
  console.log('Base58 Encoded Private Key:', encodedKey)
  return
}

try {
  let privateKey = ''
  const keypairArray = JSON.parse(fs.readFileSync(keyOrPath, 'utf8'))

  if (toBase64) {
    privateKey = Buffer.from(keypairArray).toString('base64')
  } else {
    privateKey = bs58.encode(Uint8Array.from(keypairArray))
  }

  console.log('Base58 Encoded Private Key:', privateKey)
} catch (error) {
  console.error('Error reading or parsing the file:', error.message)
  process.exit(1)
}
