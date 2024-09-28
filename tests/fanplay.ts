import { Program, utils, BN } from "@coral-xyz/anchor"
import { PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"

import { createPool, log, payoutWinners, placePick } from "lib/test-helpers"
import { Fanplay } from "target/types/fanplay"
import { truncateAddress } from "lib/string"

const { LAMPORTS_PER_SOL } = anchor.web3

describe("Fanplay program on Solana", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Fanplay as Program<Fanplay>

  const gameId = 5
  // Convert game_id (u32) to little-endian 4-byte array
  const gameIdBytes = new Uint8Array(new Uint32Array([gameId]).buffer);

  it("creates pool, places 2 picks, pays out 1 winner", async () => {
    const publicKey = provider.wallet.publicKey
    const poolId = "pickPoolId1"

    const [poolAcc] = PublicKey.findProgramAddressSync([
        utils.bytes.utf8.encode(poolId),
        gameIdBytes,
        publicKey.toBuffer(),
      ],
      program.programId
    )

    const poolKeyStr = poolAcc.toString()
    log('Pool account key', poolKeyStr)

    await createPool(poolKeyStr, poolId, gameId, provider)

    const user1 = anchor.web3.Keypair.generate()
    await placePick(poolKeyStr, user1, 1, 'w:RedDragon', provider)

    const user2 = anchor.web3.Keypair.generate()
    await placePick(poolKeyStr, user2, 2, 'w:BluePhoenix', provider)

    const updatedPool = await program.account.poolAccount.fetch(poolKeyStr)
    const updatedPoolTotal = updatedPool.poolTotal.toNumber() / LAMPORTS_PER_SOL
    log('\nupdated pool', { ...updatedPool, poolTotal: updatedPoolTotal })

    const rake = updatedPool.poolTotal
      .mul(new anchor.BN(10))
      .div(new anchor.BN(100))

    const payoutAmount = updatedPool.poolTotal.sub(rake)

    log('Rake', rake.toNumber() / LAMPORTS_PER_SOL)
    log('Payout', payoutAmount.toNumber() / LAMPORTS_PER_SOL)

    const payoutList = [
      { userKey: user1.publicKey, amount: payoutAmount },
    ]

    await payoutWinners(rake, payoutList, poolAcc, provider)

    const user1Balance = await provider.connection.getBalance(user1.publicKey)
    const logMsg = `Winner user ${user1.publicKey.toString()} balance`
    log(logMsg, user1Balance / LAMPORTS_PER_SOL)
  })

  it("creates pool, places 5 picks, pays out 2 winners", async () => {
    const publicKey = provider.wallet.publicKey
    const poolId = "pickPoolId2"

    const [poolAcc] = PublicKey.findProgramAddressSync([
        utils.bytes.utf8.encode(poolId),
        gameIdBytes,
        publicKey.toBuffer(),
      ],
      program.programId
    )

    const poolAccKeyStr = poolAcc.toString() 
    await createPool(poolAccKeyStr, poolId, gameId, provider)

    const user1 = anchor.web3.Keypair.generate()
    await placePick(poolAccKeyStr, user1, 1, 'w:RedDragon', provider)

    const user2 = anchor.web3.Keypair.generate()
    await placePick(poolAccKeyStr, user2, 6, 'w:BluePhoenix', provider)

    const user3 = anchor.web3.Keypair.generate()
    await placePick(poolAccKeyStr, user3, 3, 'w:RedDragon', provider)

    const user4 = anchor.web3.Keypair.generate()
    await placePick(poolAccKeyStr, user4, 5, 'w:YellowPicachu', provider)

    const user5 = anchor.web3.Keypair.generate()
    await placePick(poolAccKeyStr, user5, 5, 'w:WhiteUnicorn', provider)

    const updatedPool = await program.account.poolAccount.fetch(poolAccKeyStr)
    const updatedPoolTotal = updatedPool.poolTotal.toNumber() / LAMPORTS_PER_SOL
    log('\nupdated pool', { ...updatedPool, poolTotal: updatedPoolTotal })

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

    log('Rake', rake.toNumber() / LAMPORTS_PER_SOL)
    log('Payout Ref (pool - rake)', payoutAmountRef.toNumber() / LAMPORTS_PER_SOL)
    log('Total user payouts', userPayouts.toNumber() / LAMPORTS_PER_SOL)

    const payoutList = [
      { userKey: user1.publicKey, amount: user1Payout },
      { userKey: user3.publicKey, amount: user3Payout },
    ]

    await payoutWinners(rake, payoutList, poolAcc, provider)

    const user1Address = truncateAddress(user1.publicKey.toString())
    const payoutMsg1 = `User ${user1Address} payout`
    log(payoutMsg1, user1Payout.toNumber() / LAMPORTS_PER_SOL)

    const user1Balance = await provider.connection.getBalance(user1.publicKey)
    const logMsg = `Winner user ${user1Address} balance`
    log(logMsg, user1Balance / LAMPORTS_PER_SOL)


    const user3Address = truncateAddress(user3.publicKey.toString())
    const payoutMsg2 = `User ${user3Address} payout`
    log(payoutMsg2, user3Payout.toNumber() / LAMPORTS_PER_SOL)

    const user3Balance = await provider.connection.getBalance(user3.publicKey)
    const logMsg2 = `Winner user ${user3Address} balance`
    log(logMsg2, user3Balance / LAMPORTS_PER_SOL)
  })
})
