import {
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"

import { PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"

import { airdropSol, getUsdcMint, log, mintUsdc } from "lib/test-helpers"
import { Fanplay } from "target/types/fanplay"
import { truncateAddress } from "lib/string"

export interface Account {
  publicKey: anchor.web3.PublicKey
  secretKey: Uint8Array
}

export interface PoolAccount {
  tokenAccount: PublicKey
}

export const createPool = async (
  accountPubKey: PublicKey,
  poolId: string,
  gameId: number,
) => {
  const program = anchor.workspace.Fanplay as Program<Fanplay>
  const provider = anchor.AnchorProvider.env()

  const { usdcMintAddress, mintAuthority } = await getUsdcMint()

  const poolTokenAccount = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    mintAuthority,
    usdcMintAddress,
    accountPubKey,
    true
  )

  const tx = await program.methods.createPool(poolId, gameId)
    .accounts({
      poolAdmin: provider.wallet.publicKey,
      poolAccount: accountPubKey,
      poolTokenAccount: poolTokenAccount.address,

      mintAddress: usdcMintAddress,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    } as any)
    .rpc()

  const pool = await program.account.poolAccount.fetch(accountPubKey)

  return { pool, poolTokenAccount }
}

export const placePick = async (
  poolAccKey: string,
  tokenAccount: PublicKey,
  user: Account,
  amountNum: number,
  pick: string,
) => {
  const program = anchor.workspace.Fanplay as Program<Fanplay>
  const provider = anchor.AnchorProvider.env()

  await airdropSol(user)

  const { userUsdcAccount } = await mintUsdc(user.publicKey)

  const amount = new anchor.BN(amountNum * 10 ** 6)

  await program.methods.placePick(pick, amount)
    .accounts({
      poolAccount: poolAccKey,
      tokenAccount,
      userAta: userUsdcAccount.address,
      user: user.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .signers([user])
    .rpc()

  const userAddress = truncateAddress(user.publicKey.toString())
  log(`\nUser ${userAddress} pick placed:`, pick, amountNum, 'USDC')

  // Fetch new balance for the new user
  const balance = await getAccount(provider.connection, userUsdcAccount.address)
  log(`User ${userAddress} balance after pick`, Number(balance.amount) / 10 ** 6)

  return { userUsdcAccount }
}
