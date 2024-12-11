import {
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"

import { PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"

import { airdropSol, confirmTxn, log, mintUsdc } from "lib/test-helpers"
import { Fanplay } from "target/types/fanplay"
import { truncateAddress } from "lib/string"

import { Account } from './methods'

export const getPickFn = async (
  poolAccKey: string,
  tokenAccount: PublicKey,
  user: Account,
  amountNum: number,
  pick: string,
) => {
  const program = anchor.workspace.Fanplay as Program<Fanplay>

  await airdropSol(user)

  const { userUsdcAccount } = await mintUsdc(user.publicKey)

  const amount = new anchor.BN(amountNum * 10 ** 6)

  const pickFn = program.methods.placePick(pick, amount)
    .accounts({
      poolAccount: poolAccKey,
      tokenAccount,
      userAta: userUsdcAccount.address,
      user: user.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .signers([user])

  return { pickFn, userUsdcAccount }
}

export const placePick = async (
  poolAccKey: string,
  tokenAccount: PublicKey,
  user: Account,
  amountNum: number,
  pick: string,
) => {
  const provider = anchor.AnchorProvider.env()

  const { pickFn, userUsdcAccount } = await getPickFn(
    poolAccKey, tokenAccount, user, amountNum, pick
  )

  const sig = await pickFn.rpc()

  await confirmTxn(sig)

  const userAddress = truncateAddress(user.publicKey.toString())
  log(`\nUser ${userAddress} pick placed:`, pick, amountNum, 'USDC')

  // Fetch new balance for the new user
  const balance = await getAccount(provider.connection, userUsdcAccount.address)
  log(`User ${userAddress} balance after pick`, Number(balance.amount) / 10 ** 6)

  return { userUsdcAccount, sig }
}
