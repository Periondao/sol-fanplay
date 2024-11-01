import { Account as SplAccount, getAccount } from "@solana/spl-token"
import * as anchor from "@coral-xyz/anchor"

import { PoolAccount } from "./methods"

const enabled = process.env.TEST_LOGS === 'true'

export function log(...args: any[]) {
  if (enabled) console.log(...args)
}

export const logBalances = async (pool: PoolAccount, adminTokenAccount: SplAccount) => {
  const provider = anchor.AnchorProvider.env()

  const tokenBalance = await getAccount(provider.connection, pool.tokenAccount)
  log('\npool USDC account balance', Number(tokenBalance.amount) / 10 ** 6)

  const adminBalance = await getAccount(provider.connection, adminTokenAccount.address)
  log('admin USDC account balance', Number(adminBalance.amount) / 10 ** 6)
}
