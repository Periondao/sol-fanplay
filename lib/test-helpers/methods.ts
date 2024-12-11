import {
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token"

import { PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"

import { getUsdcMint } from "lib/test-helpers"
import { Fanplay } from "target/types/fanplay"

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
      systemProgram: anchor.web3.SystemProgram.programId,
    } as any)
    .rpc()

  const pool = await program.account.poolAccount.fetch(accountPubKey)

  return { pool, poolTokenAccount }
}
