use anchor_lang::prelude::*;
use anchor_lang::system_program::ID;
use anchor_lang::solana_program::entrypoint::ProgramResult;

use crate::utils::account_struct::CloseAccount;

pub fn close_accounts(
  ctx: Context<CloseAccount>,
  pool_id: String,
  game_id: u32
) -> ProgramResult {
  let pool_account = &mut ctx.accounts.pool_account;
  let pool_admin = &ctx.accounts.pool_admin;

  let game_id = &game_id.to_le_bytes();
  let seeds = &[pool_id.as_bytes(), game_id, pool_admin.key.as_ref()];

  let (derived_pool_account_key, _) = Pubkey::find_program_address(
    seeds,
    ctx.program_id,
  );

  if pool_account.key() != derived_pool_account_key {
    msg!("Pool account does not match address derived from admin account param.");
    msg!("Derivded pool account key is: {}", derived_pool_account_key);
    return Err(ProgramError::InvalidArgument);
  }

  msg!("Pool account owner is: {}", pool_account.to_account_info().owner);
  msg!("Program ID is: {}", ctx.program_id);

  // Transfer the lamports from the PDA to the destination account
  let lamports_balance = pool_account.to_account_info().lamports();

  **pool_account.to_account_info().try_borrow_mut_lamports()? -= lamports_balance;
  **pool_admin.to_account_info().try_borrow_mut_lamports()? += lamports_balance;

  // Close the PDA by setting its lamports to zero and changing its owner back to SystemProgram
  pool_account.to_account_info().realloc(0, false)?;
  pool_account.to_account_info().assign(&ID);

  Ok(())
}
