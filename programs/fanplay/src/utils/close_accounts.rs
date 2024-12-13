use anchor_lang::prelude::*;
use anchor_lang::system_program::ID;
use anchor_lang::solana_program::entrypoint::ProgramResult;

use anchor_spl::token::{self, CloseAccount, Transfer};

use crate::utils::account_struct::CloseAccount as CloseAccStruct;

pub fn close_accounts(
  ctx: Context<CloseAccStruct>,
  pool_id: String,
  game_id: u32,
  pool_bump: u8
) -> ProgramResult {
  let admin_token_acc = &ctx.accounts.admin_token_account;
  let token_account = &ctx.accounts.token_account;
  let pool_account = &ctx.accounts.pool_account;
  let pool_admin = &ctx.accounts.pool_admin;

  let game_id_bytes = &game_id.to_le_bytes();
  let seeds = &[
    pool_id.as_bytes(), game_id_bytes, pool_admin.key.as_ref()
  ];

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

  let cpi_program = ctx.accounts.token_program.to_account_info();

  // Calculate seed to sign the transaction using pool_account
  let cpi_seeds = &[
    pool_id.as_bytes(), game_id_bytes, pool_admin.key.as_ref(), &[pool_bump]
  ];
  let signer_seeds = &[&cpi_seeds[..]];

  // Check if the token account has any token balance in it
  if token_account.amount > 0 {
    // Transfer the tokens from the token account to the destination account
    let cpi_accounts = Transfer {
      from: token_account.to_account_info().clone(),
      to: admin_token_acc.to_account_info().clone(),
      authority: pool_account.to_account_info().clone(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
      cpi_program.clone(),
      cpi_accounts,
      signer_seeds,
    );
    
    let token_result = token::transfer(cpi_ctx, token_account.amount);

    if let Err(error) = token_result {
      msg!("Error sending token balance to admin token account: {:?}", error.to_string());
      return Err(ProgramError::InvalidInstructionData);
    }
  }

  // Transfer the lamport balance from the ATA to the admin account
  let cpi_acc_close = CloseAccount {
    account: token_account.to_account_info().clone(),
    destination: pool_admin.to_account_info().clone(),
    authority: pool_account.to_account_info().clone(),
  };

  let cpi_close_ctx = CpiContext::new_with_signer(
    cpi_program.clone(),
    cpi_acc_close,
    signer_seeds,
  );

  let close_result = token::close_account(cpi_close_ctx);

  if let Err(error) = close_result {
    msg!("Error closing ATA: {:?}", error.to_string());
    return Err(ProgramError::InvalidInstructionData);
  }

  // Close the ATA by setting its lamports to zero and changing its owner back to SystemProgram
  token_account.to_account_info().realloc(0, false)?;
  token_account.to_account_info().assign(&ID);

  // Transfer the lamports from the PDA to the destination account
  let lamports_balance = pool_account.to_account_info().lamports();

  **pool_account.to_account_info().try_borrow_mut_lamports()? -= lamports_balance;
  **pool_admin.to_account_info().try_borrow_mut_lamports()? += lamports_balance;

  // Close the PDA by setting its lamports to zero and changing its owner back to SystemProgram
  pool_account.to_account_info().realloc(0, false)?;
  pool_account.to_account_info().assign(&ID);

  Ok(())
}
