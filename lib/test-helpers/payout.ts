import {
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"

import { PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"

import { Fanplay } from "target/types/fanplay"

import { PoolAccount } from "./methods"
import { getUsdcMint } from "./usdc"
import { log } from "./logger"

const { LAMPORTS_PER_SOL } = anchor.web3

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

  const { usdcMintAddress, mintAuthority } = await getUsdcMint()

  const adminTokenAccount = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    mintAuthority,
    usdcMintAddress,
    provider.wallet.publicKey,
  )

  log('\nAdmin token account', adminTokenAccount.address)

  await program.methods.payout(rake, poolBump, payoutList)
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

  const poolBalance = await provider.connection.getBalance(poolAccPubKey)
  log('\npool balance', poolBalance / LAMPORTS_PER_SOL)

  const tokenBalance = await getAccount(provider.connection, pool.tokenAccount)
  log('\npool token account balance', Number(tokenBalance.amount) / 10 ** 6)

  const adminBalance = await getAccount(provider.connection, adminTokenAccount.address)
  log('admin token account balance', Number(adminBalance.amount) / 10 ** 6)
}
