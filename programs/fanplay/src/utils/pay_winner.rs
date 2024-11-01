use anchor_lang::prelude::*;
use anchor_lang::solana_program::entrypoint::ProgramResult;

use anchor_spl::token::{self, Transfer};

use crate::utils::payout_struct::{Payout, PayoutItem};

pub fn pay_winner<'info>(
  ctx: &Context<'_, '_, '_, 'info, Payout<'info>>,
  payout: &PayoutItem,
  winner_token_acc: &AccountInfo<'info>,
  signer_seeds: &[&[&[u8]]]
) -> ProgramResult
{
  let pool_token_account = &ctx.accounts.token_account;
  let pool_account = &ctx.accounts.pool_account;
  let winner_key = winner_token_acc.key();

  if payout.user_token_account != winner_key {
    msg!("Order of winner accounts does not match order of payout list");
    return Err(ProgramError::InvalidArgument);
  }

  let cpi_accounts_payout = Transfer {
    from: pool_token_account.to_account_info(),
    to: winner_token_acc.to_account_info(),
    authority: pool_account.to_account_info(),
  };

  let cpi_program = ctx.accounts.token_program.to_account_info();

  let cpi_ctx_payout = CpiContext::new_with_signer(
    cpi_program,
    cpi_accounts_payout,
    signer_seeds,
  );

  let pay_result = token::transfer(cpi_ctx_payout, payout.amount);

  if let Err(error) = pay_result {
    msg!("Error paying winner: {:?}", error.to_string());
    // TODO: change to a more especific error
    return Err(ProgramError::InvalidInstructionData);
  }

  Ok(())
}
