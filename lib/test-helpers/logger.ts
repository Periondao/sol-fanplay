import { Account as SplAccount, getAccount } from "@solana/spl-token"
import { PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"

import { LAMPORTS_PER_USDC } from "./usdc"

const enabled = process.env.TEST_LOGS === 'true'

export function log(...args: any[]) {
  if (enabled) console.log(...args)
}

export const logBalances = async (tokenAccount: PublicKey, adminTokenAccount: SplAccount) => {
  const provider = anchor.AnchorProvider.env()

  const tokenBalance = await getAccount(provider.connection, tokenAccount)
  log('\npool USDC account balance', Number(tokenBalance.amount) / LAMPORTS_PER_USDC)

  const adminBalance = await getAccount(provider.connection, adminTokenAccount.address)
  log('admin USDC account balance', Number(adminBalance.amount) / LAMPORTS_PER_USDC)
}
