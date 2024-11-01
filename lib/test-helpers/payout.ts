import {
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"

import { PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"

import { Fanplay } from "target/types/fanplay"

import { truncateAddress } from "lib/string"
import { log, logBalances } from "./logger"
import { PoolAccount } from "./methods"
import { getUsdcMint } from "./usdc"

export const getAdminTokenAccount = async () => {
  const provider = anchor.AnchorProvider.env()

  const { usdcMintAddress, mintAuthority } = await getUsdcMint()

  const adminTokenAccount = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    mintAuthority,
    usdcMintAddress,
    provider.wallet.publicKey,
  )

  return adminTokenAccount
}


interface PayoutItem {
  userTokenAccount: PublicKey
  userKey: PublicKey
  amount: anchor.BN
}

export const payoutWinners = async (
  rake: anchor.BN,
  payoutList: PayoutItem[],
  poolAccPubKey: PublicKey,
  pool: PoolAccount,
  poolBump: number,
) => {
  const program = anchor.workspace.Fanplay as Program<Fanplay>
  const provider = anchor.AnchorProvider.env()

  const remainingAccounts = payoutList.map(({ userTokenAccount }) => ({
    pubkey: userTokenAccount,
    isSigner: false,
    isWritable: true,
  }))

  const adminTokenAccount = await getAdminTokenAccount()

  const sig = await program.methods.payout(rake, poolBump, payoutList)
    .accounts({
      poolAccount: poolAccPubKey,
      tokenAccount: pool.tokenAccount,

      poolAdmin: provider.wallet.publicKey,
      adminTokenAccount: adminTokenAccount.address,
      
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .remainingAccounts(remainingAccounts)
    .rpc()

  log('\nPayout complete! Txn signature:', truncateAddress(sig))

  await logBalances(pool, adminTokenAccount)
}
