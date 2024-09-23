import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import * as BufferLayout from "buffer-layout"

import { Fanplay } from "../target/types/fanplay"

const { LAMPORTS_PER_SOL } = anchor.web3

const strategy = {
  preflightCommitment: 'processed',
  commitment: 'confirmed',
}

describe("Fanplay program on Solana", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Fanplay as Program<Fanplay>

  it("Is initialized!", async () => {
    const poolAccount = anchor.web3.Keypair.generate()

    const tx = await program.methods.createPool('randomGameId', 1)
      .accounts({
        systemProgram: anchor.web3.SystemProgram.programId,
        poolAccount: poolAccount.publicKey,
        user: provider.wallet.publicKey,
      } as any)
      .signers([poolAccount])
      .rpc()

    console.log("\nPool created, transaction signature", tx)

    const pool = await program.account.poolAccount.fetch(poolAccount.publicKey)

    console.log('\npool state', pool)

    const newUser = anchor.web3.Keypair.generate()

    // Airdrop some SOL to the new user
    const sig = await provider.connection.requestAirdrop(newUser.publicKey, 50 * LAMPORTS_PER_SOL)
    const confirmation = await provider.connection.confirmTransaction(sig)
    console.log('\nairdrop confirmation to new user', confirmation)

    const amount = new anchor.BN(1 * LAMPORTS_PER_SOL)
    const tx2 = await program.methods.placePick('w:RedDragon', amount)
      .accounts({
        systemProgram: anchor.web3.SystemProgram.programId,
        poolAccount: poolAccount.publicKey,
        user: newUser.publicKey,
      } as any)
      .signers([newUser])
      .rpc()

    console.log("\n\nUser 1 Pick placed, txn signature", tx2)

    // Fetch new balance for the new user
    const balance = await provider.connection.getBalance(newUser.publicKey)
    console.log('user 1 balance after pick', balance)

    let updatedPool = await program.account.poolAccount.fetch(poolAccount.publicKey)
    // console.log('\nupdated pool', updatedPool)

    const newUser2 = anchor.web3.Keypair.generate()

    // Airdrop some SOL to the new user
    const sig2 = await provider.connection.requestAirdrop(newUser2.publicKey, 50 * LAMPORTS_PER_SOL)
    const confirmation2 = await provider.connection.confirmTransaction(sig2)
    // console.log('\nairdrop confirmation to new user 2', confirmation2)
  
    // Fetch new balance for the new user
    const balance2 = await provider.connection.getBalance(newUser.publicKey)
    console.log('\nuser 2 balance after pick', balance2)

    const amount2 = new anchor.BN(1 * LAMPORTS_PER_SOL)
    const tx3 = await program.methods.placePick('w:BluePhoenix', amount2)
      .accounts({
        systemProgram: anchor.web3.SystemProgram.programId,
        poolAccount: poolAccount.publicKey,
        user: newUser2.publicKey,
      } as any)
      .signers([newUser2])
      .rpc()

    // console.log("\n\nPick placed user 2, txn signature", tx3)

    updatedPool = await program.account.poolAccount.fetch(poolAccount.publicKey)
    console.log('\nupdated pool', updatedPool)

    const { minRent, poolTotal } = updatedPool

    const picksTotal = poolTotal.toNumber() / LAMPORTS_PER_SOL
    console.log('\nTotal picks amount', picksTotal)
    console.log('Min rent', minRent.toNumber() / LAMPORTS_PER_SOL)

    let poolBalance = await provider.connection.getBalance(poolAccount.publicKey)
    console.log('pool balance', poolBalance / LAMPORTS_PER_SOL)

    const withdrawable = new anchor.BN(poolBalance).sub(minRent)
    const rake = withdrawable.mul(new anchor.BN(10)).div(new anchor.BN(100))
    const payoutAmount = withdrawable.sub(rake)

    console.log('\nWithdrawable', withdrawable.toNumber() / LAMPORTS_PER_SOL)
    console.log('Rake', rake.toNumber() / LAMPORTS_PER_SOL)
    console.log('Payout', payoutAmount.toNumber() / LAMPORTS_PER_SOL)

    const payoutList = [
      { userKey: newUser.publicKey, amount: payoutAmount },
    ]

    const tx4 = await program.methods.payout(rake, payoutList)
      .accounts({
        systemProgram: anchor.web3.SystemProgram.programId,
        poolAccount: poolAccount.publicKey,
        user: provider.wallet.publicKey,
      } as any)
      .remainingAccounts([
        { pubkey: newUser.publicKey, isSigner: false, isWritable: true },
      ])
      .rpc()

    // console.log("\n\nPayout txn signature", tx4)

    poolBalance = await provider.connection.getBalance(poolAccount.publicKey)
    console.log('\npool balance', poolBalance / LAMPORTS_PER_SOL)

    const newUserBalance = await provider.connection.getBalance(newUser.publicKey)
    console.log('final user 1 balance', newUserBalance / LAMPORTS_PER_SOL)
  })
})
