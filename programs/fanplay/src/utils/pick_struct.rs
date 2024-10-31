use anchor_lang::prelude::*;

use anchor_spl::token::{Token, TokenAccount};

use crate::utils::account_struct::PoolAccount;

#[derive(Accounts)]
pub struct PlacePick<'info> {
  #[account(mut)]
  pub pool_account: Account<'info, PoolAccount>,

  #[account(mut)]
  pub token_account: Account<'info, TokenAccount>,

  #[account(mut)]
  pub user_ata: Account<'info, TokenAccount>,
  pub user: Signer<'info>,

  pub system_program: Program<'info, System>,
  pub token_program: Program<'info, Token>,
}
