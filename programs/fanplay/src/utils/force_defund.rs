use anchor_lang::solana_program::entrypoint::ProgramResult;

use anchor_lang::prelude::*;
 
pub fn force_defund(ctx: Context<ForceDefund>) -> ProgramResult {
  let account = &ctx.accounts.account;

  let data = account.try_borrow_data()?;
  assert!(data.len() > 8);

  let is_data_zeroed = data.iter().all(|&byte| byte == 0);

  if !is_data_zeroed {
    msg!("Account data is not zeroed out.");
    return Err(ProgramError::InvalidAccountData.into());
  }

  let dest_starting_lamports = ctx.accounts.destination.lamports();

  **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
    .checked_add(account.lamports())
    .unwrap();

  **account.lamports.borrow_mut() = 0;

  Ok(())
}
  
#[derive(Accounts)]
pub struct ForceDefund<'info> {
  /// CHECK: This account is the recipient of the lamports
  destination: AccountInfo<'info>,
  /// CHECK: This account is the account to be zeroed out
  account: AccountInfo<'info>,
}
