import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { assert } from "chai"

import { Fanplay } from "target/types/fanplay"
import { truncateAddress } from "lib/string"

import { getAdminTokenAccount } from "./payout"
import { Account, confirmTxn } from "./methods"
import { log } from "./logger"

const { LAMPORTS_PER_SOL } = anchor.web3

export const airdropSol = async (user: Account, userType = 'punter') => {
  const provider = anchor.AnchorProvider.env()

  // Airdrop some SOL to the new user
  const sig = await provider.connection.requestAirdrop(
    user.publicKey,
    10 * LAMPORTS_PER_SOL
  )

  await confirmTxn(sig)

  const userAddress = truncateAddress(user.publicKey.toString())
  log(`\nAirdrop of 10 SOL made to ${userType}:`, userAddress)
}

export const closeAccounts = async (
  poolAccount: PublicKey,
  tokenAccount: PublicKey,
  poolId: string,
  gameId: number,
  poolBump: number
) => {
  const program = anchor.workspace.Fanplay as Program<Fanplay>
  const provider = anchor.AnchorProvider.env()
  const adminTokenAcc = await getAdminTokenAccount()

  const adminBalanceBefore = await provider.connection.getBalance(
    provider.wallet.publicKey
  )
  log('\nAdmin SOL balance before:', adminBalanceBefore)

  const accBalanceBefore = await provider.connection.getBalance(poolAccount)
  log('Pool account lamports before:', accBalanceBefore)

  const tokenAccInfoBefore = await provider.connection.getAccountInfo(tokenAccount)
  log('Token acc lamports before:', tokenAccInfoBefore.lamports)

  log('Pool + token lamports before:', accBalanceBefore + tokenAccInfoBefore.lamports)

  const tx = await program.methods.closeAccounts(poolId, gameId, poolBump)
    .accounts({
      systemProgram: anchor.web3.SystemProgram.programId,
      adminTokenAccount: adminTokenAcc.address,
      poolAdmin: provider.wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenAccount,
      poolAccount,
    } as any)
    .rpc()

  await confirmTxn(tx)

  const tokenAcc = await provider.connection.getBalance(tokenAccount)
  assert.isTrue(tokenAcc === 0, 'Token account lamports are not 0')

  const accBalance = await provider.connection.getBalance(poolAccount)
  assert.isTrue(accBalance === 0, 'Pool account balance is not 0')

  log('\nBalances after closing accounts:\n')
  log('Pool account lamports:', accBalance)
  log('Token acc lamports:', tokenAcc)

  const adminBalance = await provider.connection.getBalance(
    provider.wallet.publicKey
  )
  log('Admin SOL balance change:', adminBalance - adminBalanceBefore)
}
