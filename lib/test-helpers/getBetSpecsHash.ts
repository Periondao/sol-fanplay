import { blake2b } from 'blakejs'
import { BN } from 'bn.js'

export const getBetSpecsHash = (
  previousHashOnChain: number,
  picksHashOnChain: string,
  betSpecStr: string,
  amountInUSDC: number,
) => {
   // Convert the previous hash (number) to a hex string
   const amountBN = new BN(amountInUSDC * 10 ** 6)
   const amountStr = amountBN.toString('hex')
   const previousHashHex = previousHashOnChain.toString(16)

   // Concatenate previousHashHex, pickSpec, and amountStr
   const newInputStr = `${previousHashHex}${betSpecStr}${amountStr}`

   // Create a new Blake2b hash with 32-bytes
   const hashRaw = blake2b(newInputStr, undefined, 32)
   const newHash = hashRaw.slice(0, 4)

   const betU32Hash = new DataView(newHash.buffer).getUint32(0, true)

   const picksHashNum = parseInt(picksHashOnChain)

   const isHashOk = picksHashNum === betU32Hash

  return isHashOk
}
