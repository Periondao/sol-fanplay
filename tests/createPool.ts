import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"

import { Fanplay } from "../target/types/fanplay"

describe("Tests for the createPool pub function", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Fanplay as Program<Fanplay>

  it("Is initialized correctly if it receives correct arguments")
  it("Fails if the pool already exists")
  // Should fail if gameId is not a number, less than 1, undefined/null
  it("Fails if the game id is not valid")
  // Should fail if it's not a string, or if it is empty/undefined/null
  it("Fails if poolId is not valid")
})
