import * as anchor from "@coral-xyz/anchor"

import { truncateAddress } from "lib/string"

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
