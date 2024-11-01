import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token"
import { PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"

import { airdropSol } from "./account"
import { log } from "./logger"

let mintAuthority: anchor.web3.Keypair
let usdcMintVar: PublicKey

export const LAMPORTS_PER_USDC = 10 ** 6

export const getUsdcMint = async () => {
  if (usdcMintVar) return { usdcMintAddress: usdcMintVar, mintAuthority }

  const provider = anchor.AnchorProvider.env()

  mintAuthority = anchor.web3.Keypair.generate()
  await airdropSol(mintAuthority, 'USDC mint authority')

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
    10 * LAMPORTS_PER_USDC
  )

  log(
    'Minted 10 USDC to user ATA (token account)',
    userUsdcAccount.address.toString()
  )

  return { userUsdcAccount, mintSignature }
}
