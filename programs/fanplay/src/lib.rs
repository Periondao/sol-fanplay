use anchor_lang::solana_program::entrypoint::ProgramResult;
use anchor_lang::prelude::*;

declare_id!("CyDt5Z3G4vaD15SXeGmGJc3yqPoej7PpqMP2fjkpGYhn");

#[program]
pub mod fanplay {
  use super::*;

  pub fn create_pool(ctx: Context<CreatePool>, pool_id: String, game_id: u32) -> ProgramResult {
    let pool_account = &mut ctx.accounts.pool_account;
    pool_account.pool_id = pool_id;
    pool_account.game_id = game_id;
    pool_account.pool_total = 0;
    pool_account.pick_count = 0;

    Ok(())
  }

  pub fn place_pick(ctx: Context<PlacePick>, pick_spec: String, amount: u64) -> ProgramResult {
    let ix = anchor_lang::solana_program::system_instruction::transfer(
      &ctx.accounts.user.key(),
      &ctx.accounts.pool_account.key(),
      amount,
    );

    // The return of ::invoke() could be an Err and should be handled
    let transfer_result = anchor_lang::solana_program::program::invoke(
      &ix,
      &[
        ctx.accounts.user.to_account_info(),
        ctx.accounts.pool_account.to_account_info(),
      ]
    );

    if let Err(error) = transfer_result {
      msg!("Error: {:?}", error.to_string());
      return Err(error);
    }

    let user_pick = UserPick {
      user_address: *ctx.accounts.user.key,
      pick_spec,
      amount,
    };

    let pool_account = &mut ctx.accounts.pool_account;
    
    pool_account.picks.push(user_pick);
    pool_account.pool_total += amount;
    pool_account.pick_count += 1;

    Ok(())
  }
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
  #[account(init, payer = user, space = 1420)]
  pub pool_account: Account<'info, PoolAccount>,

  #[account(mut)]
  pub user: Signer<'info>,

  pub system_program: Program<'info, System>,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct UserPick {
  pub user_address: Pubkey, // 32 bytes
  pub pick_spec: String, // 4 bytes + size of string (lets max at 16 chars/bytes)
  // In SOL
  pub amount: u64, // 8 bytes
}
// Total size = 16 + 4 + 8 = 28 bytes

#[account]
pub struct PoolAccount {
  // QUESTION: Should this be a string? Is it easy to search for a pool by string?
  pub pool_id: String, // 4 bytes + size of string (lets max at 32 chars/bytes)
  pub game_id: u32, // 4 bytes
  // In SOL
  pub pool_total: u64, // 8 bytes
  pub pick_count: u32, // 4 bytes
  pub picks: Vec<UserPick>, // 8 bytes + size of vector (lets max at 10 bets, 10 * 28 = 280 bytes)
}
// Total size = 4 + 4 + 8 + 4 + 280 = 300 bytes

// QUESTION: how much does it cost to store a pool_account for one month?
// would it be wise to save a replica of the pool_account on the DB,
// and maintain only a hash of that data on-chain?

#[derive(Accounts)]
pub struct PlacePick<'info> {
  #[account(mut)]
  pub pool_account: Account<'info, PoolAccount>,

  #[account(mut)]
  pub user: Signer<'info>,

  pub system_program: Program<'info, System>,
}
