import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token"
import { PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"

import { airdropSol } from "./methods"
import { log } from "./logger"

let mintAuthority: anchor.web3.Keypair
let usdcMintVar: PublicKey

export const LAMPORTS_PER_USDC = 10 ** 6

export const getUsdcMint = async () => {
  if (usdcMintVar) return { usdcMintAddress: usdcMintVar, mintAuthority }

  const provider = anchor.AnchorProvider.env()

  mintAuthority = anchor.web3.Keypair.generate()
  await airdropSol(mintAuthority)

  usdcMintVar = await createMint(
    provider.connection,
    mintAuthority,
    mintAuthority.publicKey,
    null,
    6,
  )

  log("USDC mint created", usdcMintVar.toString())

  return { usdcMintAddress: usdcMintVar, mintAuthority }
}

export const mintUsdc = async (userKey: PublicKey) => {
  const provider = anchor.AnchorProvider.env()
  const { usdcMintAddress } = await getUsdcMint()

  const userUsdcAccount = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    mintAuthority,
    usdcMintAddress,
    userKey
  )

  const mintSignature = await mintTo(
    provider.connection,
    mintAuthority,
    usdcMintAddress,
    userUsdcAccount.address,
    mintAuthority,
    10 * 10 ** 6
  )
  log('Minted 10 USDC to', userUsdcAccount.address.toString())

  return { userUsdcAccount, mintSignature }
}
