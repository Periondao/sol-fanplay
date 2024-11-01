use anchor_lang::prelude::*;

use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct UserPick {
  pub user_key: Pubkey, // 32 bytes
  pub pick_spec: String, // 4 bytes + size of string (lets max at 16 chars/bytes)
  // In SOL
  pub amount: u64, // 8 bytes
}
// Total size = 32 + (4 + 16) + 8 = 60 bytes

#[account]
pub struct PoolAccount {
  // QUESTION: Should this be a string? Is it easy to search for a pool by string?
  pub pool_id: String, // 4 bytes + size of string (lets max at 32 chars/bytes)
  pub game_id: u32, // 4 bytes
  // In SOL
  pub pool_total: u64, // 8 bytes
  pub pick_count: u32, // 4 bytes
  pub admin_key: Pubkey, // 32 bytes
  pub end_time: i64, // 8 bytes
  pub token_account: Pubkey, // 32 bytes
  pub picks: Vec<UserPick>, // 8 bytes + size of vector (lets max at 10 bets, 10 * 60 + 8 = 608 bytes)
}

// Up To token_acc => 4 + 32 + 16 + 32 + 8 + 32 = 124 bytes
// Total size => 124 + (8 + 600) = 732 bytes

// QUESTION: how much does it cost to store a pool_account for one month?
// would it be wise to save a replica of the pool_account on the DB,
// and maintain only a hash of that data on-chain?

#[derive(Accounts)]
#[instruction(pool_id: String, game_id: u32)]
pub struct CreatePool<'info> {
  #[account(mut)]
  pub pool_admin: Signer<'info>,

  #[account(
    init,
    payer = pool_admin,
    space = 732,
    seeds = [pool_id.as_bytes(), &game_id.to_le_bytes()[..], pool_admin.key().as_ref()],
    bump
  )]
  pub pool_account: Account<'info, PoolAccount>,

  #[account(mut)]
  pub pool_token_account: Account<'info, TokenAccount>,

  pub mint_address: Account<'info, Mint>,
  pub token_program: Program<'info, Token>,
  pub system_program: Program<'info, System>,
  pub associated_token_program: Program<'info, AssociatedToken>,
}
