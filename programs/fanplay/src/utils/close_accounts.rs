use anchor_lang::prelude::*;
use anchor_lang::system_program::ID;
use anchor_lang::solana_program::entrypoint::ProgramResult;

use anchor_spl::token::{self, Transfer};

use crate::utils::account_struct::CloseAccount;

pub fn close_accounts(
  ctx: Context<CloseAccount>,
  pool_id: String,
  game_id: u32,
  pool_bump: u8
) -> ProgramResult {
  let pool_account = &mut ctx.accounts.pool_account;
  let token_account = &ctx.accounts.token_account;
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

  // Check if the token account has any token balance in it
  if token_account.amount > 0 {
    // Transfer the tokens from the token account to the destination account
    let cpi_accounts = Transfer {
      from: token_account.to_account_info().clone(),
      to: pool_admin.to_account_info().clone(),
      authority: pool_account.to_account_info().clone(),
    };

    // Calculate seed to sign the transaction using pool_account
    let cpi_seeds = &[pool_id.as_bytes(), game_id, pool_admin.key.as_ref(), &[pool_bump]];
    let signer_seeds = &[&cpi_seeds[..]];

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(
      cpi_program,
      cpi_accounts,
      signer_seeds,
    );
    
    let token_result = token::transfer(cpi_ctx, token_account.amount);

    if let Err(error) = token_result {
      msg!("Error sending token balance to admin account: {:?}", error.to_string());
      return Err(ProgramError::InvalidInstructionData);
    }
  }

  let token_acc_lamports = token_account.to_account_info().lamports();

  **token_account.to_account_info().try_borrow_mut_lamports()? -= token_acc_lamports;
  **pool_admin.to_account_info().try_borrow_mut_lamports()? += token_acc_lamports;

  Ok(())
}
