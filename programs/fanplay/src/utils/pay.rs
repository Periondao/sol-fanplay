use anchor_lang::prelude::*;
use anchor_lang::solana_program::entrypoint::ProgramResult;

use anchor_spl::token::{self, Transfer};

use crate::utils::payout_struct::{Payout, PayoutItem};

pub fn payout(ctx: Context<Payout>, rake: u64, pool_bump: u8, payout_list: Vec<PayoutItem>) -> ProgramResult {
  let admin_token_account = &mut ctx.accounts.admin_token_account;
  let pool_token_account = &mut ctx.accounts.token_account;
  let pool_account = &mut ctx.accounts.pool_account;
  let winner_accounts = &ctx.remaining_accounts;
  let pool_admin = &mut ctx.accounts.pool_admin;

  if *pool_admin.key != pool_account.admin_key {
    msg!("User is not the admin of the pool");
    return Err(ProgramError::IncorrectProgramId);
  }

  if winner_accounts.len() != payout_list.len() {
    msg!("Number of winners does not match payout list");
    return Err(ProgramError::InvalidArgument);
  }

  // Iterate over payout list and get total amount to be paid
  let mut total_payout = 0;
  for payout in payout_list.iter() {
    total_payout += payout.amount;
  }

  let payouts_and_rake = total_payout + rake;

  if payouts_and_rake > pool_account.pool_total {
    return Err(ProgramError::InsufficientFunds);
  }

  // Pay out rake
  let cpi_accounts_rake = Transfer {
    from: pool_token_account.to_account_info().clone(),
    to: admin_token_account.to_account_info().clone(),
    authority: pool_account.to_account_info().clone(),
  };

  let cpi_program = ctx.accounts.token_program.to_account_info();

  // Calculate seed to sign the transaction using pool_account
  let pool_id = pool_account.pool_id.clone();
  let game_id = &pool_account.game_id.to_le_bytes();
  let admin_key = pool_admin.key.as_ref();
  let seeds = &[pool_id.as_bytes(), game_id, admin_key, &[pool_bump]];
  let signer_seeds = &[&seeds[..]];

  let cpi_ctx = CpiContext::new_with_signer(
    cpi_program,
    cpi_accounts_rake,
    signer_seeds,
  );

  let rake_result = token::transfer(cpi_ctx, rake);

  if let Err(error) = rake_result {
    msg!("Error paying rake: {:?}", error.to_string());
    return Err(ProgramError::InvalidInstructionData);
  }

  // // To pay out winners, iterate over winner accounts,
  // // use its index to find the user_key in the payout_list,
  // // and transfer the amount to the winner
  // for (index, winner_acc) in winner_accounts.iter().enumerate() {
  //   let payout = payout_list.get(index).unwrap();
  //   let winner_key = *winner_acc.key;

  //   if payout.token_acc_key != winner_key {
  //     msg!("Order of winner accounts does not match order of payout list");
  //     return Err(ProgramError::InvalidArgument);
  //   }

  //   // Pay out winner USDC
  //   let cpi_accounts_payout = Transfer {
  //     from: pool_token_account.to_account_info(),
  //     to: winner_acc.to_account_info(),
  //     authority: pool_admin.to_account_info(),
  //   };

  //   let cpi_program = ctx.accounts.token_program.to_account_info();
  //   let cpi_ctx_payout = CpiContext::new(cpi_program, cpi_accounts_payout);

  //   token::transfer(cpi_ctx_payout, payout.amount);
  // }

  Ok(())
}
