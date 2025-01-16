pub mod utils;

use anchor_lang::prelude::*;
use anchor_lang::solana_program::entrypoint::ProgramResult;

use utils::account_struct::*;
use utils::accounts::create_pool as mod_create_pool;
use utils::close_accounts::close_accounts as mod_close_accounts;

use utils::force_defund::*;
use utils::force_defund::force_defund as mod_force_defund;

use utils::pick_struct::*;
use utils::picks::place_pick as mod_place_pick;

use utils::payout_struct::*;
use utils::pay::payout as mod_payout;

declare_id!("J1pLyfJHnRkvmhSi7wL4MteRm8ftt2djXt24CxgsNeoH");

#[program]
pub mod fanplay {
  use super::*;

  pub fn create_pool(ctx: Context<CreatePool>, pool_id: String, game_id: u32) -> ProgramResult {
    return mod_create_pool(ctx, pool_id, game_id);    
  }

  pub fn place_pick(ctx: Context<PlacePick>, pick_spec: String, amount: u64) -> ProgramResult {
    return mod_place_pick(ctx, pick_spec, amount);
  }

  pub fn payout<'info>(
    ctx: Context<'_, '_, '_, 'info, Payout<'info>>,
    rake: u64,
    pool_bump: u8,
    payout_list: Vec<PayoutItem>
  ) -> ProgramResult
  {
    return mod_payout(ctx, rake, pool_bump, payout_list);
  }

  pub fn close_accounts(
    ctx: Context<CloseAccount>,
    pool_id: String,
    game_id: u32,
    pool_bump: u8
  ) -> ProgramResult {
    return mod_close_accounts(ctx, pool_id, game_id, pool_bump);
  }

  pub fn force_defund(ctx: Context<ForceDefund>) -> ProgramResult {
    return mod_force_defund(ctx);
  }
}
