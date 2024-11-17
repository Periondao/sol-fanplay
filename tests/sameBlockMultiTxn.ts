import { GetVersionedTransactionConfig, PublicKey } from "@solana/web3.js"
import { Program, utils } from "@coral-xyz/anchor"
import * as anchor from "@coral-xyz/anchor"

import {
  createPool,
  log,
  getPickFn,
} from "lib/test-helpers"

import { Fanplay } from "target/types/fanplay"
import { assert } from "chai"

describe("Fanplay program - same block multi txn", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Fanplay as Program<Fanplay>

  const gameId = 5
  // Convert game_id (u32) to little-endian 4-byte array
  const gameIdBytes = new Uint8Array(new Uint32Array([gameId]).buffer)

  it("simulates many bets mined on the same block", async () => {
    const poolId = "pickPoolId5498"

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

    const { blockhash } = await provider.connection.getLatestBlockhash()

    const user1 = anchor.web3.Keypair.generate()
    const { pickFn: u1PickFn } = await getPickFn(
      poolKeyStr, poolTokenAccount.address, user1, 1, 'w:HammyHamilton'
    )

    const user2 = anchor.web3.Keypair.generate()
    const { pickFn: u2PickFn } = await getPickFn(
      poolKeyStr, poolTokenAccount.address, user2, 2, 'w:MaxFurstappen'
    )

    const u1PickTxn = await u1PickFn.transaction()
    u1PickTxn.recentBlockhash = blockhash
    u1PickTxn.sign(user1)

    const u2PickTxn = await u2PickFn.transaction()
    u2PickTxn.recentBlockhash = blockhash
    u2PickTxn.sign(user2)

    const txnList = [u1PickTxn, u2PickTxn]

    const signatures = await Promise.all(
      txnList.map(txn => provider.connection.sendRawTransaction(txn.serialize()))
    )

    await new Promise(resolve => setTimeout(resolve, 1000))

    const versionedTxnConfig = {
      maxSupportedTransactionVersion: 2,
      commitment: 'confirmed',
    } as GetVersionedTransactionConfig

    // Get transaction details from chain
    const txns = await Promise.all(
      signatures.map(async (sign, i) => await provider.connection.getTransaction(
        sign, versionedTxnConfig
      ))
    )

    txns.forEach(txn => {
      const balanceAndHashLog = txn.meta.logMessages.filter(
        msg => msg.includes('account balance:') || msg.includes('New hash:')
      )

      assert(balanceAndHashLog.length === 2, 'Expected 2 log messages')
    })
  })
})
