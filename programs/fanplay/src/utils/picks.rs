use anchor_lang::prelude::*;
use anchor_lang::solana_program::entrypoint::ProgramResult;

use anchor_spl::token::Transfer;

use crate::utils::account_struct::UserPick;
use crate::utils::pick_struct::PlacePick;

pub fn place_pick(ctx: Context<PlacePick>, pick_spec: String, amount: u64) -> ProgramResult {
  let transfer_ix = Transfer{
    from: ctx.accounts.user_ata.to_account_info(),
    to: ctx.accounts.token_account.to_account_info(),
    authority: ctx.accounts.user.to_account_info(),
  };

  let cpi_program = ctx.accounts.token_program.to_account_info();
  let cpi_ctx = CpiContext::new(cpi_program, transfer_ix);

  let transfer_result = anchor_spl::token::transfer(cpi_ctx, amount);

  if let Err(error) = transfer_result {
    msg!("Error: {:?}", error.to_string());
    // TODO: return a more specific error
    return Err(ProgramError::InvalidInstructionData);
  }

  let user_pick = UserPick {
    user_key: *ctx.accounts.user.key,
    pick_spec,
    amount,
  };

  let pool_account = &mut ctx.accounts.pool_account;
  
  pool_account.picks.push(user_pick);
  pool_account.pool_total += amount;
  pool_account.pick_count += 1;

  Ok(())
}
