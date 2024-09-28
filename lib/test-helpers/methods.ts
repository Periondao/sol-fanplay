import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { PublicKey } from "@solana/web3.js"

import { Fanplay } from "target/types/fanplay"
import { truncateAddress } from "lib/string"
import { log } from "lib/test-helpers"

const { LAMPORTS_PER_SOL } = anchor.web3

interface Account {
  publicKey: anchor.web3.PublicKey
  secretKey: Uint8Array
}

export const createPool = async (
  accountPubKey: string,
  poolId: string,
  gameId: number,
  provider: anchor.AnchorProvider
) => {
  const program = anchor.workspace.Fanplay as Program<Fanplay>

  const tx = await program.methods.createPool(poolId, gameId)
    .accounts({
      systemProgram: anchor.web3.SystemProgram.programId,
      user: provider.wallet.publicKey,
      poolAccount: accountPubKey,
    } as any)
    // .signers([poolAccount])
    .rpc()

  log("\nPool created, tnx signature", truncateAddress(tx))

  const pool = await program.account.poolAccount.fetch(accountPubKey)

  log('pool state', pool)

  return pool
}

export const airdropSol = async (user: Account, provider: anchor.AnchorProvider) => {
    // Airdrop some SOL to the new user
    const sig = await provider.connection.requestAirdrop(
      user.publicKey,
      50 * LAMPORTS_PER_SOL
    )
    await provider.connection.confirmTransaction(sig)

    const userAddress = truncateAddress(user.publicKey.toString())
    log('\nAirdrop of 50 sol made to user:', userAddress)
}

export const placePick = async (
  poolAccPubKey: string,
  user: Account,
  amountNum: number,
  pick: string,
  provider: anchor.AnchorProvider
) => {
  await airdropSol(user, provider)

  const program = anchor.workspace.Fanplay as Program<Fanplay>
  const amount = new anchor.BN(amountNum * LAMPORTS_PER_SOL)
  log('amounto', amount)

  await program.methods.placePick(pick, amount)
    .accounts({
      systemProgram: anchor.web3.SystemProgram.programId,
      poolAccount: poolAccPubKey,
      user: user.publicKey,
    } as any)
    .signers([user])
    .rpc()

  const userAddress = truncateAddress(user.publicKey.toString())
  log(`\nUser ${userAddress} pick placed:`, pick, amountNum, 'SOL')

  // Fetch new balance for the new user
  const balance = await provider.connection.getBalance(user.publicKey)
  log(`User ${userAddress} balance after pick`, balance)
}

interface PayoutItem {
  userKey: anchor.web3.PublicKey
  amount: anchor.BN
}

export const payoutWinners = async (
  rake: anchor.BN,
  payoutList: PayoutItem[],
  poolAccPubKey: PublicKey,
  provider: anchor.AnchorProvider
) => {
  const program = anchor.workspace.Fanplay as Program<Fanplay>

  const remainingAccounts = payoutList.map(({ userKey }) => ({
    pubkey: userKey,
    isSigner: false,
    isWritable: true,
  }))

  await program.methods.payout(rake, payoutList)
    .accounts({
      systemProgram: anchor.web3.SystemProgram.programId,
      poolAccount: poolAccPubKey,
      user: provider.wallet.publicKey,
    } as any)
    .remainingAccounts(remainingAccounts)
    .rpc()

  const poolBalance = await provider.connection.getBalance(poolAccPubKey)
  log('\npool balance', poolBalance / LAMPORTS_PER_SOL)
}
