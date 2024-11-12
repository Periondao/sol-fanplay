use anchor_lang::prelude::*;
use anchor_lang::solana_program::entrypoint::ProgramResult;

use crate::utils::account_struct::CreatePool;

pub fn create_pool(ctx: Context<CreatePool>, pool_id: String, game_id: u32) -> ProgramResult {
  // TODO: check if pool_id has 32 bytes max    
  let pool_account = &mut ctx.accounts.pool_account;
  pool_account.pool_id = pool_id;
  pool_account.game_id = game_id;
  pool_account.pick_count = 0;
  pool_account.picks_hash = 0;

  Ok(())
}
