use anchor_lang::solana_program::entrypoint::ProgramResult;
use anchor_lang::solana_program::rent::Rent;
use anchor_lang::prelude::*;

declare_id!("CyDt5Z3G4vaD15SXeGmGJc3yqPoej7PpqMP2fjkpGYhn");

#[program]
pub mod fanplay {
  use super::*;

  pub fn create_pool(ctx: Context<CreatePool>, pool_id: String, game_id: u32) -> ProgramResult {
    let pool_account = &mut ctx.accounts.pool_account;
    pool_account.admin_key = *ctx.accounts.user.key;
    pool_account.pool_id = pool_id;
    pool_account.game_id = game_id;
    pool_account.pool_total = 0;
    pool_account.pick_count = 0;

    let rent = Rent::get()?;
    pool_account.min_rent = rent.minimum_balance(340); // Space declared on CreatePool - space = 340

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
      user_key: *ctx.accounts.user.key,
      pick_spec,
      amount,
    };

    let pool_account = &mut ctx.accounts.pool_account;
    
    pool_account.picks.push(user_pick);
    pool_account.pool_total += amount;
    pool_account.pick_count += 1;

    Ok(())
  }

  pub fn payout(ctx: Context<Payout>, rake: u64, payout_list: Vec<PayoutItem>) -> ProgramResult {
    let pool_account = &mut ctx.accounts.pool_account;
    let winner_accounts = &ctx.remaining_accounts;
    let user = &mut ctx.accounts.user;

    if *user.key != pool_account.admin_key {
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

    // Calculate pool's withdrawable amount
    let data_len = pool_account.picks.len();
    let rent_balance = Rent::get()?.minimum_balance(data_len);

    let pool_lamports = **pool_account.to_account_info().try_borrow_mut_lamports()?;
    let withdrawable = pool_lamports - rent_balance;

    if payouts_and_rake > withdrawable {
      return Err(ProgramError::InsufficientFunds);
    }

    // Pay out rake
    **pool_account.to_account_info().try_borrow_mut_lamports()? -= rake;
    **user.to_account_info().try_borrow_mut_lamports()? += rake;

    // To pay out winners, iterate over winner accounts,
    // use its index to find the user_key in the payout_list,
    // and transfer the amount to the winner
    for (index, winner_acc) in winner_accounts.iter().enumerate() {
      let payout = payout_list.get(index).unwrap();
      let winner_key = *winner_acc.key;

      if payout.user_key != winner_key {
        msg!("Order of winner accounts does not match order of payout list");
        return Err(ProgramError::InvalidArgument);
      }

      **pool_account.to_account_info().try_borrow_mut_lamports()? -= payout.amount;
      **winner_acc.to_account_info().try_borrow_mut_lamports()? += payout.amount;
    }

    Ok(())
  }
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
  #[account(init, payer = user, space = 340)]
  pub pool_account: Account<'info, PoolAccount>,

  #[account(mut)]
  pub user: Signer<'info>,

  pub system_program: Program<'info, System>,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct UserPick {
  pub user_key: Pubkey, // 32 bytes
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
  pub admin_key: Pubkey, // 32 bytes
  pub min_rent: u64, // 8 bytes
  pub picks: Vec<UserPick>, // 8 bytes + size of vector (lets max at 10 bets, 10 * 28 = 280 bytes)
}
// Total size = 4 + 4 + 8 + 4 + 32 + 8 + 280 = 340 bytes

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

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct PayoutItem {
  pub user_key: Pubkey,
  pub amount: u64,
}

#[derive(Accounts)]
pub struct Payout<'info> {
  #[account(mut)]
  pub pool_account: Account<'info, PoolAccount>,

  #[account(mut)]
  pub user: Signer<'info>,

  pub system_program: Program<'info, System>,
}
