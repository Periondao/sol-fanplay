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
} from "lib/test-helpers"

import { Fanplay } from "target/types/fanplay"

describe("Fanplay program - e2e basic", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Fanplay as Program<Fanplay>

  const gameId = 5
  // Convert game_id (u32) to little-endian 4-byte array
  const gameIdBytes = new Uint8Array(new Uint32Array([gameId]).buffer)

  it("creates pool, places 2 picks, pays out 1 winner", async () => {
    const poolId = "pickPoolId1"

    const [poolAcc, poolBump] = PublicKey.findProgramAddressSync([
        utils.bytes.utf8.encode(poolId),
        gameIdBytes,
        provider.wallet.publicKey.toBuffer(),
      ],
      program.programId
    )

    const poolKeyStr = poolAcc.toString()
    log('Pool account key', poolKeyStr)

    const pool = await createPool(poolAcc, poolId, gameId)

    const user1 = anchor.web3.Keypair.generate()
    const { userUsdcAccount } = await placePick(poolKeyStr, pool, user1, 1, 'w:RedDragon')

    const user2 = anchor.web3.Keypair.generate()
    await placePick(poolKeyStr, pool, user2, 2, 'w:BluePhoenix')

    const updatedPool = await program.account.poolAccount.fetch(poolKeyStr)
    const updatedPoolTotal = updatedPool.poolTotal.toNumber() / LAMPORTS_PER_USDC
    log('\nupdated pool', { ...updatedPool, poolTotal: updatedPoolTotal })

    const poolTokenAcc = await getAccount(provider.connection, pool.tokenAccount)
    log('\npool token account address', pool.tokenAccount.toString())
    log('pool token account balance', Number(poolTokenAcc.amount) / 10 ** 6)

    const rake = updatedPool.poolTotal
      .mul(new anchor.BN(10))
      .div(new anchor.BN(100))

    const payoutAmount = updatedPool.poolTotal.sub(rake)

    log('Rake', rake.toNumber() / LAMPORTS_PER_USDC)
    log('Payout', payoutAmount.toNumber() / LAMPORTS_PER_USDC)

    const payoutList = [
      { userKey: user1.publicKey, userTokenAccount: userUsdcAccount.address, amount: payoutAmount },
    ]

    await payoutWinners(rake, payoutList, poolAcc, pool, poolBump)

    const user1Balance = await provider.connection.getBalance(user1.publicKey)
    const logMsg = `Winner user ${user1.publicKey.toString()} balance`
    log(logMsg, user1Balance / LAMPORTS_PER_USDC)
  })
})
