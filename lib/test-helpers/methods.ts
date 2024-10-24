import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"

import { PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"

import { getUsdcMint, log, mintUsdc } from "lib/test-helpers"
import { Fanplay } from "target/types/fanplay"
import { truncateAddress } from "lib/string"

const { LAMPORTS_PER_SOL } = anchor.web3

interface Account {
  publicKey: anchor.web3.PublicKey
  secretKey: Uint8Array
}

interface PoolAccount {
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
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    } as any)
    .rpc()

  log("\nPool created, tnx signature", truncateAddress(tx))

  const pool = await program.account.poolAccount.fetch(accountPubKey)

  log('pool state', pool)

  return pool
}

export const airdropSol = async (user: Account) => {
  const provider = anchor.AnchorProvider.env()

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
  poolAccKey: string,
  poolAcc: PoolAccount,
  user: Account,
  amountNum: number,
  pick: string,
) => {
  await airdropSol(user)

  const { userUsdcAccount } = await mintUsdc(user.publicKey)

  const program = anchor.workspace.Fanplay as Program<Fanplay>
  const provider = anchor.AnchorProvider.env()

  const amount = new anchor.BN(amountNum * 10 ** 6)

  await program.methods.placePick(pick, amount)
    .accounts({
      poolAccount: poolAccKey,
      tokenAccount: poolAcc.tokenAccount,
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
