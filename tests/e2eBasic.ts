import { Program, utils } from "@coral-xyz/anchor"
import { getAccount } from "@solana/spl-token"
import { PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"
import { assert } from "chai"

import {
  payoutWinners,
  createPool,
  placePick,
  log,
  LAMPORTS_PER_USDC,
  getAdminTokenAccount,
  logBalances,
} from "lib/test-helpers"

import { getBetSpecsHash } from "lib/test-helpers"
import { Fanplay } from "target/types/fanplay"
import { truncateAddress } from "lib/string"

describe("Fanplay program - e2e basic", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Fanplay as Program<Fanplay>

  const gameId = 5
  // Convert game_id (u32) to little-endian 4-byte array
  const gameIdBytes = new Uint8Array(new Uint32Array([gameId]).buffer)

  it("creates pool, places 2 picks, pays out 1 winner", async () => {
    const poolId = "pickPoolId14896"

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
    const { userUsdcAccount, sig } = await placePick(poolKeyStr, poolTokenAccount.address, user1, 1, user1BetSpec)

    const user2BetSpec = 'w:MaxFurstappen'
    const user2 = anchor.web3.Keypair.generate()
    const { sig: sig2 } = await placePick(poolKeyStr, poolTokenAccount.address, user2, 2, user2BetSpec)

    const adminTokenAccount = await getAdminTokenAccount()
    await logBalances(poolTokenAccount.address, adminTokenAccount)

    const user1BalanceBefore = await getAccount(provider.connection, userUsdcAccount.address)
    const logMsgBef = `Winner user ${truncateAddress(user1.publicKey.toString())} balance`
    log(logMsgBef, Number(user1BalanceBefore.amount) / LAMPORTS_PER_USDC)

    const signatures = [
      [sig, user1BetSpec, '1'],
      [sig2, user2BetSpec, '2'],
    ]

    await Promise.all(signatures.map(async ([sig, betSpecStr, amount]) => {
      const txn = await provider.connection.getParsedTransaction(sig, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      })

      let newPicksTotal = ''
      let previousHash = ''
      let newHash = ''
    
      const balanceLogTxt = 'Account balance before bet:'
    
      txn?.meta?.logMessages?.forEach(logMessage => {
        if (logMessage.includes('New hash')) {
          const split = logMessage.split('New hash: ').pop()
          if (split) newHash = split
        }
    
        if (logMessage.includes(balanceLogTxt)) {
          const split = logMessage.split(balanceLogTxt).pop()
          if (split) newPicksTotal = split.trim()
        }
    
        if (logMessage.includes('Previous hash:')) {
          const split = logMessage.split('Previous hash: ').pop()
          if (split) previousHash = split
        }

        if (logMessage.includes('New input string:')) {
          console.log('New input string:', logMessage)
        }
      })

      const isHashOk = getBetSpecsHash(
        +previousHash,
        newHash,
        betSpecStr,
        +amount,
      )

      assert.isTrue(isHashOk, 'Bet hash is not correct')
    }))

    const poolTokenBalance = await getAccount(provider.connection, poolTokenAccount.address)

    const balanceBN = new anchor.BN(Number(poolTokenBalance.amount))
    const rake = balanceBN
      .mul(new anchor.BN(10))
      .div(new anchor.BN(100))

    const payoutAmount = balanceBN.sub(rake)

    log('\nWill pay rake:', rake.toNumber() / LAMPORTS_PER_USDC)
    log('Will pay winner:', payoutAmount.toNumber() / LAMPORTS_PER_USDC)

    const payoutList = [
      { userKey: user1.publicKey, userTokenAccount: userUsdcAccount.address, amount: payoutAmount },
    ]

    await payoutWinners(rake, payoutList, poolAcc, poolTokenAccount.address, poolBump)

    const user1Balance = await getAccount(provider.connection, userUsdcAccount.address)
    const logMsg = `Winner user ${truncateAddress(user1.publicKey.toString())} balance`
    log(logMsg, Number(user1Balance.amount) / LAMPORTS_PER_USDC)
  })
})
