use anchor_lang::prelude::*;
use anchor_lang::solana_program::entrypoint::ProgramResult;

use anchor_spl::token::{self, Transfer};

use crate::{utils::payout_struct::Payout, PayoutItem};
use crate::utils::pay_winner::pay_winner;

pub fn payout<'info>(
  ctx: Context<'_, '_, '_, 'info, Payout<'info>>,
  rake: u64,
  pool_bump: u8,
  payout_list: Vec<PayoutItem>
) -> ProgramResult
{
  let admin_token_account = &mut ctx.accounts.admin_token_account;
  let pool_token_account = &mut ctx.accounts.token_account;
  let pool_account = &ctx.accounts.pool_account;
  let pool_account_info = pool_account.clone().to_account_info();
  let winner_accounts = ctx.remaining_accounts;
  let pool_admin = &mut ctx.accounts.pool_admin;
  let admin_key = pool_admin.key;

  let pool_id = pool_account.pool_id.clone();
  let game_id = &pool_account.game_id.to_le_bytes();
  let seeds = &[pool_id.as_bytes(), game_id, admin_key.as_ref()];

  let (derived_pool_account_key, _) = Pubkey::find_program_address(
    seeds,
    ctx.program_id,
  );

  if *pool_account_info.key != derived_pool_account_key {
    msg!("Pool account does not match address derived from admin account param.");
    return Err(ProgramError::InvalidArgument);
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
  let ata_balance = pool_token_account.amount;

  if payouts_and_rake > ata_balance {
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
  let cpi_seeds = &[pool_id.as_bytes(), game_id, admin_key.as_ref(), &[pool_bump]];
  let signer_seeds = &[&cpi_seeds[..]];

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

  // To pay out winners, iterate over winner accounts,
  // use its index to find the user_key in the payout_list,
  // and transfer the amount to the winner
  for (index, winner_token_acc) in winner_accounts.iter().enumerate() {
    let payout = payout_list.get(index).unwrap();

    let pay_result = pay_winner(&ctx, payout, winner_token_acc, signer_seeds);

    if let Err(error) = pay_result {
      // TODO: this is being double logged, fix it
      msg!("Error paying winner: {:?}", error.to_string());
      return Err(ProgramError::InvalidInstructionData);
    }
  }

  Ok(())
}
