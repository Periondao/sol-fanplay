import { Program, utils } from "@coral-xyz/anchor"
import { getAccount } from "@solana/spl-token"
import { PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"
import { expect } from "chai"

import {
  payoutWinners,
  createPool,
  placePick,
  log,
  getPoolAccount,
  getAdminTokenAccount,
  logBalances,
  LAMPORTS_PER_USDC,
} from "lib/test-helpers"

import { Fanplay } from "target/types/fanplay"
import { truncateAddress } from "lib/string"

describe("Fanplay program - e2e with more bets", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Fanplay as Program<Fanplay>

  const gameId = 5
  // Convert game_id (u32) to little-endian 4-byte array
  const gameIdBytes = new Uint8Array(new Uint32Array([gameId]).buffer)

  it("creates pool, places 5 picks, pays out 2 winners", async () => {
    const publicKey = provider.wallet.publicKey
    const poolId = "pickPoolId2"

    const [poolAcc, poolBump] = PublicKey.findProgramAddressSync([
        utils.bytes.utf8.encode(poolId),
        gameIdBytes,
        publicKey.toBuffer(),
      ],
      program.programId
    )

    const poolAccKeyStr = poolAcc.toString() 
    const pool = await createPool(poolAcc, poolId, gameId)

    const user1 = anchor.web3.Keypair.generate()
    const { userUsdcAccount } = await placePick(poolAccKeyStr, pool, user1, 1, 'w:ChewsainBolt')

    const user2 = anchor.web3.Keypair.generate()
    await placePick(poolAccKeyStr, pool, user2, 6, 'w:MaxFurstappen')

    const user3 = anchor.web3.Keypair.generate()
    const { userUsdcAccount: user3TokenAcc } = await placePick(
      poolAccKeyStr, pool, user3, 3, 'w:ChewsainBolt'
    )

    const user4 = anchor.web3.Keypair.generate()
    await placePick(poolAccKeyStr, pool, user4, 5, 'w:HammyHamilton')

    const user5 = anchor.web3.Keypair.generate()
    await placePick(poolAccKeyStr, pool, user5, 5, 'w:SpeedDemon')

    const updatedPool = await getPoolAccount(poolAccKeyStr)
    const adminTokenAccount = await getAdminTokenAccount()
    await logBalances(updatedPool, adminTokenAccount)

    const user1BalanceBefore = await getAccount(provider.connection, userUsdcAccount.address)
    const logMsgBef = `Winner user1 ${truncateAddress(user1.publicKey.toString())} balance`
    log(logMsgBef, Number(user1BalanceBefore.amount) / LAMPORTS_PER_USDC)

    const user3BalanceBefore = await getAccount(provider.connection, user3TokenAcc.address)
    const logMsg3Bef = `Winner user3 ${truncateAddress(user3.publicKey.toString())} balance`
    log(logMsg3Bef, Number(user3BalanceBefore.amount) / LAMPORTS_PER_USDC)

    const rakeRef = updatedPool.poolTotal
      .mul(new anchor.BN(10))
      .div(new anchor.BN(100))

    const payoutAmountRef = updatedPool.poolTotal.sub(rakeRef)
    const user1Payout = payoutAmountRef.div(new anchor.BN(4))
    const user3Payout = payoutAmountRef
      .div(new anchor.BN(4))
      .mul(new anchor.BN(3))

    const userPayouts = user1Payout.add(user3Payout)
    const rake = updatedPool.poolTotal.sub(userPayouts)

    log('\nWill pay rake:', rake.toNumber() / LAMPORTS_PER_USDC)
    log('Will pay winners:', userPayouts.toNumber() / LAMPORTS_PER_USDC)
    log('User1 bet 1 USDC, gets 25%, user3 bet 3 USDC, gets 75% of payouts')

    const payoutList = [
      { userKey: user1.publicKey, amount: user1Payout, userTokenAccount: userUsdcAccount.address },
      { userKey: user3.publicKey, amount: user3Payout, userTokenAccount: user3TokenAcc.address },
    ]

    await payoutWinners(rake, payoutList, poolAcc, pool, poolBump)

    const user1Balance = await getAccount(provider.connection, userUsdcAccount.address)
    const logMsg = `Winner user ${truncateAddress(user1.publicKey.toString())} balance`
    const user1BalanceUSDC = Number(user1Balance.amount) / LAMPORTS_PER_USDC
    log(logMsg, user1BalanceUSDC)

    expect(user1BalanceUSDC).equal(13.5)

    const user3Balance = await getAccount(provider.connection, user3TokenAcc.address)
    const logMsg3 = `Winner user3 ${truncateAddress(user3.publicKey.toString())} balance`
    const user3BalanceUSDC = Number(user3Balance.amount) / LAMPORTS_PER_USDC
    log(logMsg3, user3BalanceUSDC)

    expect(user3BalanceUSDC).equal(20.5)
  })
})
