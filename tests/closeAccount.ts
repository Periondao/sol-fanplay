import { Program, utils } from "@coral-xyz/anchor"
import { getAccount } from "@solana/spl-token"
import { PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"

import {
  payoutWinners,
  createPool,
  placePick,
  log,
  LAMPORTS_PER_USDC,
  getAdminTokenAccount,
  logBalances,
  closeAccounts,
} from "lib/test-helpers"

import { Fanplay } from "target/types/fanplay"
import { truncateAddress } from "lib/string"

describe("Fanplay program - e2e closeAccounts", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Fanplay as Program<Fanplay>

  const gameId = 5
  // Convert game_id (u32) to little-endian 4-byte array
  const gameIdBytes = new Uint8Array(new Uint32Array([gameId]).buffer)

  it("creates pool, places picks, pays winner, closes accounts", async () => {
    const poolId = "pickPoolId84948"

    const [poolAcc, poolBump] = PublicKey.findProgramAddressSync([
        utils.bytes.utf8.encode(poolId),
        gameIdBytes,
        provider.wallet.publicKey.toBuffer(),
      ],
      program.programId
    )

    const poolKeyStr = poolAcc.toString()
    log('Created pool data account:', poolKeyStr, program.programId.toString())

    const { poolTokenAccount } = await createPool(poolAcc, poolId, gameId)

    const user1BetSpec = 'w:HammyHamilton'
    const user1 = anchor.web3.Keypair.generate()
    const { userUsdcAccount } = await placePick(
      poolKeyStr, poolTokenAccount.address, user1, 1, user1BetSpec
    )

    const user2BetSpec = 'w:MaxFurstappen'
    const user2 = anchor.web3.Keypair.generate()
    await placePick(poolKeyStr, poolTokenAccount.address, user2, 2, user2BetSpec)

    const adminTokenAccount = await getAdminTokenAccount()
    await logBalances(poolTokenAccount.address, adminTokenAccount)

    const user1BalanceBefore = await getAccount(provider.connection, userUsdcAccount.address)
    const logMsgBef = `Winner user ${truncateAddress(user1.publicKey.toString())} balance`
    log(logMsgBef, Number(user1BalanceBefore.amount) / LAMPORTS_PER_USDC)

    const poolTokenBalance = await getAccount(provider.connection, poolTokenAccount.address)
    const balanceBN = new anchor.BN(Number(poolTokenBalance.amount))
    const rake = balanceBN
      .mul(new anchor.BN(10))
      .div(new anchor.BN(100))

    // Subtract extra 5% just to simulate balance remaning in token acc after closing
    const extra5 = balanceBN
      .mul(new anchor.BN(5))
      .div(new anchor.BN(100))

    const payoutAmount = balanceBN.sub(rake).sub(extra5)

    const payoutList = [
      { userKey: user1.publicKey, userTokenAccount: userUsdcAccount.address, amount: payoutAmount },
    ]

    await payoutWinners(rake, payoutList, poolAcc, poolTokenAccount.address, poolBump)

    await closeAccounts(poolAcc, poolTokenAccount.address, poolId, gameId, poolBump)
  })
})
