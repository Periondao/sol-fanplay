pub mod utils;

use anchor_lang::prelude::*;
use anchor_lang::solana_program::entrypoint::ProgramResult;

use utils::account_struct::*;
use utils::accounts::create_pool as mod_create_pool;

use utils::pick_struct::*;
use utils::picks::place_pick as mod_place_pick;

use utils::payout_struct::*;
use utils::pay::payout as mod_payout;

declare_id!("Gwy5zyzMnHTi5CeASEEAHH3LdVtFe3urLZgNoxmMPMyJ");

#[program]
pub mod fanplay {
  use super::*;

  pub fn create_pool(ctx: Context<CreatePool>, pool_id: String, game_id: u32) -> ProgramResult {
    return mod_create_pool(ctx, pool_id, game_id);    
  }

  pub fn place_pick(ctx: Context<PlacePick>, pick_spec: String, amount: u64) -> ProgramResult {
    return mod_place_pick(ctx, pick_spec, amount);
  }

  pub fn payout(ctx: Context<Payout>, rake: u64, pool_bump: u8, payout_list: Vec<PayoutItem>) -> ProgramResult {
    return mod_payout(ctx, rake, pool_bump, payout_list);
  }
}
