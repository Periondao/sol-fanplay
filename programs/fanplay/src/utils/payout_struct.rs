use anchor_lang::prelude::*;

use anchor_spl::token::{Token, TokenAccount};

use crate::utils::account_struct::PoolAccount;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct PayoutItem {
  pub user_token_account: Pubkey,
  pub user_key: Pubkey,
  pub amount: u64,
}

#[derive(Accounts)]
pub struct Payout<'info> {
  #[account(mut)]
  pub pool_account: Account<'info, PoolAccount>,

  #[account(mut)]
  pub token_account: Account<'info, TokenAccount>,

  #[account(mut)]
  pub pool_admin: Signer<'info>,

  #[account(mut)]
  pub admin_token_account: Account<'info, TokenAccount>,

  pub system_program: Program<'info, System>,
  pub token_program: Program<'info, Token>,
}
