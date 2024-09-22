import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"

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

    // Fetch new balance for the new user
    const balance = await provider.connection.getBalance(newUser.publicKey)
    console.log('new user balance', balance)

    const amount = new anchor.BN(1 * LAMPORTS_PER_SOL)
    const tx2 = await program.methods.placePick('w:RedDragon', amount)
      .accounts({
        systemProgram: anchor.web3.SystemProgram.programId,
        poolAccount: poolAccount.publicKey,
        user: newUser.publicKey,
      } as any)
      .signers([newUser])
      .rpc()

    console.log("\n\nPick placed, txn signature", tx2)

    const updatedPool = await program.account.poolAccount.fetch(poolAccount.publicKey)
    console.log('\nupdated pool', updatedPool)
  })
})
