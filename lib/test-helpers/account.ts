import { Program } from "@coral-xyz/anchor"
import * as anchor from "@coral-xyz/anchor"

import { Fanplay } from "target/types/fanplay"
import { truncateAddress } from "lib/string"

import { LAMPORTS_PER_USDC } from "./usdc"
import { Account } from "./methods"
import { log } from "./logger"

const { LAMPORTS_PER_SOL } = anchor.web3

export const airdropSol = async (user: Account, userType = 'punter') => {
  const provider = anchor.AnchorProvider.env()

  // Airdrop some SOL to the new user
  const sig = await provider.connection.requestAirdrop(
    user.publicKey,
    10 * LAMPORTS_PER_SOL
  )
  await provider.connection.confirmTransaction(sig)

  const userAddress = truncateAddress(user.publicKey.toString())
  log(`\nAirdrop of 10 SOL made to ${userType}:`, userAddress)
}

export const getPoolAccount = async (poolKeyStr: string) => {
  const program = anchor.workspace.Fanplay as Program<Fanplay>

  const pool = await program.account.poolAccount.fetch(poolKeyStr)
  const poolTotal = pool.poolTotal.toNumber() / LAMPORTS_PER_USDC

  const formattedPool = {
    ...pool,
    adminKey: pool.adminKey.toString(),
    tokenAccount: pool.tokenAccount.toString(),
    poolTotal: poolTotal,
  }

  log('\nupdated pool', formattedPool)

  return pool
}
