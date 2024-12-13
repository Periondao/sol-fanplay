const { Keypair } = require('@solana/web3.js')

// Read private key from command line arguments
if (process.argv.length < 3) {
  console.error("Usage: node base58ToArrayKey.js <base58_private_key>")
  process.exit(1)
}

// Base64-encoded private key
const base64PrivateKey = process.argv[2]

// Decode the Base64 private key
const decodedKey = Uint8Array.from(Buffer.from(base64PrivateKey, 'base64'))

// Convert the Uint8Array to a regular array
const keyArray = Array.from(decodedKey)

const keypair = Keypair.fromSecretKey(decodedKey)
console.log("Public Key:", keypair.publicKey.toBase58())

// Convert the array to a JSON string
const stringifiedKey = JSON.stringify(keyArray)

console.log("Array Key as stringified JSON:", stringifiedKey)
