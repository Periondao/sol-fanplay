import { Account as SplAccount, getAccount } from "@solana/spl-token"
import * as anchor from "@coral-xyz/anchor"

import { LAMPORTS_PER_USDC } from "./usdc"
import { PoolAccount } from "./methods"

const enabled = process.env.TEST_LOGS === 'true'

export function log(...args: any[]) {
  if (enabled) console.log(...args)
}

export const logBalances = async (pool: PoolAccount, adminTokenAccount: SplAccount) => {
  const provider = anchor.AnchorProvider.env()

  const tokenBalance = await getAccount(provider.connection, pool.tokenAccount)
  log('\npool USDC account balance', Number(tokenBalance.amount) / LAMPORTS_PER_USDC)

  const adminBalance = await getAccount(provider.connection, adminTokenAccount.address)
  log('admin USDC account balance', Number(adminBalance.amount) / LAMPORTS_PER_USDC)
}
